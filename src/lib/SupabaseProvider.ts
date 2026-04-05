import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Observable } from 'lib0/observable';

/**
 * Supabase Realtime Broadcast 기반 Yjs Provider
 *
 * y-webrtc/y-websocket 대신 Supabase Broadcast를 사용하여
 * Yjs 문서 업데이트를 클라이언트 간에 relay합니다.
 *
 * ── 재연결 로직 ──
 * - 채널 에러/타임아웃 감지 → 지수 백오프 후 자동 재연결
 * - 브라우저 탭 복귀(visibilitychange) 시 연결 상태 확인 → 필요시 재연결
 */

const MAX_RETRY_DELAY = 30_000; // 최대 30초 대기
const BASE_RETRY_DELAY = 1_000; // 첫 재시도 1초

export class SupabaseProvider extends Observable<string> {
  private channel: RealtimeChannel | null = null;
  doc: Y.Doc;
  awareness: Awareness;
  private roomName: string;
  private synced = false;
  private _destroyed = false;

  // ── 재연결용 상태 ──
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private handleVisibility = () => this.onVisibilityChange();

  constructor(roomName: string, doc: Y.Doc) {
    super();
    this.roomName = roomName;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    if (supabase) {
      this.connect();
      // 브라우저 탭 복귀 시 연결 상태 확인
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  private connect() {
    if (!supabase || this._destroyed) return;

    // 기존 채널 정리
    this.cleanupChannel();

    this.channel = supabase.channel(`yjs-${this.roomName}`, {
      config: { broadcast: { self: false, ack: true } },
    });

    // 다른 사용자의 Yjs 업데이트 수신
    this.channel.on('broadcast', { event: 'yjs-update' }, (payload) => {
      if (this._destroyed) return;
      try {
        const update = this.base64ToUint8Array(payload.payload.update);
        Y.applyUpdate(this.doc, update, 'supabase');
      } catch (err) {
        console.warn('[SupabaseProvider] failed to apply update:', err);
      }
    });

    // Awareness 업데이트 수신
    this.channel.on('broadcast', { event: 'yjs-awareness' }, (payload) => {
      if (this._destroyed) return;
      try {
        const update = this.base64ToUint8Array(payload.payload.update);
        applyAwarenessUpdate(this.awareness, update, 'supabase');
      } catch (err) {
        console.warn('[SupabaseProvider] failed to apply awareness:', err);
      }
    });

    // 새 접속자의 동기화 요청 수신 → 현재 상태 전송
    this.channel.on('broadcast', { event: 'yjs-sync-request' }, () => {
      if (this._destroyed) return;
      const state = Y.encodeStateAsUpdate(this.doc);
      this.channel?.send({
        type: 'broadcast',
        event: 'yjs-sync-response',
        payload: { update: this.uint8ArrayToBase64(state) },
      });
    });

    // 기존 접속자로부터 전체 상태 수신
    this.channel.on('broadcast', { event: 'yjs-sync-response' }, (payload) => {
      if (this._destroyed) return;
      try {
        const update = this.base64ToUint8Array(payload.payload.update);
        Y.applyUpdate(this.doc, update, 'supabase');
        if (!this.synced) {
          this.synced = true;
          this.emit('synced', [{ synced: true }]);
        }
      } catch (err) {
        console.warn('[SupabaseProvider] failed to apply sync response:', err);
      }
    });

    this.channel.subscribe((status, err) => {
      console.log(`[SupabaseProvider] channel status: ${status}`, err ?? '');

      if (this._destroyed) return;

      if (status === 'SUBSCRIBED') {
        console.log('[SupabaseProvider] ✅ connected to channel:', `yjs-${this.roomName}`);
        this.retryCount = 0; // 성공 → 재시도 카운터 초기화

        // 기존 접속자에게 동기화 요청
        this.channel?.send({
          type: 'broadcast',
          event: 'yjs-sync-request',
          payload: {},
        });

        // 1초 후에도 sync 안 됐으면 자체적으로 synced 처리
        setTimeout(() => {
          if (!this.synced && !this._destroyed) {
            this.synced = true;
            this.emit('synced', [{ synced: true }]);
          }
        }, 1000);
      }

      // ── 에러/타임아웃 → 자동 재연결 ──
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[SupabaseProvider] ⚠️ channel ${status}, scheduling reconnect...`);
        this.scheduleReconnect();
      }

      // CLOSED 상태: 명시적으로 닫은 게 아니면 재연결
      if (status === 'CLOSED' && !this._destroyed) {
        console.warn('[SupabaseProvider] ⚠️ channel CLOSED unexpectedly, scheduling reconnect...');
        this.scheduleReconnect();
      }
    });

    // 로컬 변경 → broadcast
    this.doc.on('update', this.handleDocUpdate);

    // Awareness 변경 → broadcast
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  // ── 재연결 스케줄러 (지수 백오프) ──
  private scheduleReconnect() {
    if (this._destroyed) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);

    const delay = Math.min(BASE_RETRY_DELAY * 2 ** this.retryCount, MAX_RETRY_DELAY);
    this.retryCount++;
    console.log(`[SupabaseProvider] 🔄 reconnecting in ${delay}ms (attempt #${this.retryCount})...`);

    this.retryTimer = setTimeout(() => {
      if (this._destroyed) return;
      this.synced = false;
      this.connect();
    }, delay);
  }

  // ── 브라우저 탭 복귀 감지 ──
  private onVisibilityChange() {
    if (document.visibilityState !== 'visible' || this._destroyed) return;

    // 채널이 없거나 연결 상태가 아닌 경우 재연결
    if (!this.channel) {
      console.log('[SupabaseProvider] 🔄 tab visible, no channel → reconnecting...');
      this.retryCount = 0;
      this.synced = false;
      this.connect();
      return;
    }

    // Supabase 채널의 현재 상태를 확인하여 재연결 필요 여부 결정
    // 채널이 존재하지만 sync-request를 보내서 연결 상태 확인
    console.log('[SupabaseProvider] 📱 tab visible, sending sync-request to verify connection...');
    this.channel.send({
      type: 'broadcast',
      event: 'yjs-sync-request',
      payload: {},
    }).catch(() => {
      // send 실패 → 채널 끊김, 재연결
      console.warn('[SupabaseProvider] ⚠️ send failed on tab resume → reconnecting...');
      this.retryCount = 0;
      this.synced = false;
      this.connect();
    });
  }

  // ── 기존 채널 정리 (재연결 전) ──
  private cleanupChannel() {
    if (this.channel) {
      this.doc.off('update', this.handleDocUpdate);
      this.awareness.off('update', this.handleAwarenessUpdate);
      if (supabase) {
        supabase.removeChannel(this.channel);
      }
      this.channel = null;
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'supabase' || this._destroyed || !this.channel) return;
    console.log('[SupabaseProvider] broadcasting update, bytes:', update.byteLength);
    this.channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: { update: this.uint8ArrayToBase64(update) },
    });
  };

  private handleAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    if (this._destroyed || !this.channel) return;
    const changedClients = added.concat(updated).concat(removed);
    const encodedUpdate = encodeAwarenessUpdate(this.awareness, changedClients);
    this.channel.send({
      type: 'broadcast',
      event: 'yjs-awareness',
      payload: { update: this.uint8ArrayToBase64(encodedUpdate) },
    });
  };

  // ── 유틸리티 ──

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    this.awareness.destroy();
    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
    }
    this.channel = null;
    super.destroy();
  }
}
