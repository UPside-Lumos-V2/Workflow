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
 */
export class SupabaseProvider extends Observable<string> {
  private channel: RealtimeChannel | null = null;
  doc: Y.Doc;
  awareness: Awareness;
  private roomName: string;
  private synced = false;
  private _destroyed = false;

  constructor(roomName: string, doc: Y.Doc) {
    super();
    this.roomName = roomName;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    if (supabase) {
      this.connect();
    }
  }

  private connect() {
    if (!supabase || this._destroyed) return;

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
      if (status === 'SUBSCRIBED' && !this._destroyed) {
        console.log('[SupabaseProvider] ✅ connected to channel:', `yjs-${this.roomName}`);
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
    });

    // 로컬 변경 → broadcast
    this.doc.on('update', this.handleDocUpdate);

    // Awareness 변경 → broadcast
    this.awareness.on('update', this.handleAwarenessUpdate);
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
