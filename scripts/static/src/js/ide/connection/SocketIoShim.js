/* global io */

import { debugConsole } from '@/utils/debugging'
import EventEmitter from '@/utils/EventEmitter'

class SocketShimBase {
  // unused vars kept to document the interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static connect(url, options) {
    return new SocketShimBase()
  }

  constructor(socket) {
    this._socket = socket
  }

  forceDisconnectWithoutEvent() {}
}
const transparentMethods = [
  'connect',
  'disconnect',
  'emit',
  'on',
  'removeListener',
]
for (const method of transparentMethods) {
  SocketShimBase.prototype[method] = function () {
    this._socket[method].apply(this._socket, arguments)
  }
}

class SocketShimNoop extends SocketShimBase {
  static connect() {
    return new SocketShimNoop()
  }

  constructor(socket) {
    super(socket)
    this.socket = {
      get connected() {
        return true // offline build: pretend permanent connection
      },
      get sessionid() {
        return 'offline'
      },
      get transport() {
        return { name: 'websocket' }
      },

      connect() {},
      // unused vars kept to document the interface
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disconnect(reason) {},
    }

    // Offline build: real registry of event listeners so client code that
    // expects upstream's server-pushed events (file-tree mutations, etc.)
    // can be triggered locally. Stored as Map<event, Set<handler>>.
    this._listeners = new Map()

    // Expose the singleton so offline glue (sync-mutation, upload-success)
    // can synthesize "recive*" events after local writes succeed.
    window.__socket = this
  }

  connect() {}
  // unused vars kept to document the interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disconnect(reason) {}

  // Offline build: synthesize replies for the few request/response
  // socket events the IDE actually waits on. Without this the
  // DocumentContainer.joinDoc() callback never fires and the editor
  // gets stuck on "no_selection_select_file".
  emit(...args) {
    const event = args[0]
    const cb = args.length > 0 && typeof args[args.length - 1] === 'function'
      ? args[args.length - 1]
      : null
    if (!cb) return
    if (event === 'joinDoc') {
      // joinDoc(doc_id, [version,] options, cb) — reply with empty doc lines,
      // version 0, no updates, no ranges, default sharejs-text-ot type.
      const seed = (window.__seedDocLines && window.__seedDocLines[args[1]]) || ['']
      cb(null, seed, 0, [], { changes: [], comments: [] }, 'sharejs-text-ot')
      return
    }
    if (event === 'leaveDoc') {
      cb(null)
      return
    }
    if (event === 'clientTracking.getConnectedUsers') {
      cb(null, [])
      return
    }
    if (event === 'getProjectMembers') {
      cb(null, [])
      return
    }
    // For unknown events, call back with no error so the IDE doesn't hang.
    cb(null)
  }

  on(event, handler) {
    let set = this._listeners.get(event)
    if (!set) {
      set = new Set()
      this._listeners.set(event, set)
    }
    set.add(handler)
  }

  removeListener(event, handler) {
    const set = this._listeners.get(event)
    if (set) set.delete(handler)
  }

  // Offline-only helper: fire all registered handlers for `event`. Called by
  // sync-mutation / upload-success glue to simulate server push messages.
  _simulate(event, ...args) {
    const set = this._listeners.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        handler(...args)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`SocketShimNoop handler for ${event} threw:`, e)
      }
    }
  }
}

// Offline build: `window.io` is set to `null` in main.tsx, so we always pick
// the no-op shim. Upstream's v0/v2 socket.io shims have been stripped — see
// git history if you need to re-introduce real socket transport.
debugConsole.log('[socket.io] Shim: offline build, using noop')
const current = SocketShimNoop

export class SocketIOMock extends SocketShimBase {
  constructor() {
    super(new EventEmitter())
    this.socket = {
      get connected() {
        return false
      },
      get sessionid() {
        return undefined
      },
      get transport() {
        return {}
      },
      get transports() {
        return []
      },

      connect() {},
      // unused vars kept to document the interface
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disconnect(reason) {},
    }
  }

  addListener(event, listener) {
    this._socket.on(event, listener)
  }

  removeListener(event, listener) {
    this._socket.off(event, listener)
  }

  disconnect() {
    this.emitToClient('disconnect')
  }

  emitToClient(...args) {
    // Round-trip through JSON.parse/stringify to simulate (de-)serializing on network layer.
    this.emit(...JSON.parse(JSON.stringify(args)))
  }

  countEventListeners(event) {
    return this._socket.events[event].length
  }
}

export default {
  SocketShimNoop,
  current,
  connect: current.connect,
  stub: () => new SocketShimNoop(),
}
