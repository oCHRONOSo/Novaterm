# SSH Connection Workflow Documentation

This document describes the complete workflow of SSH connections in Novaterm, from initial connection to disconnection and reconnection.

## Table of Contents
1. [Initial Setup & State Management](#initial-setup--state-management)
2. [Connection Methods](#connection-methods)
3. [Connection Flow](#connection-flow)
4. [Terminal Tab Connections](#terminal-tab-connections)
5. [Disconnection Flow](#disconnection-flow)
6. [Reconnection & Session Management](#reconnection--session-management)
7. [Credential Storage](#credential-storage)

---

## Initial Setup & State Management

### Socket Context Provider (`contexts/socket-context.tsx`)

The `SocketProvider` manages all connection state globally:

**Initial State:**
- On app load, checks `sessionStorage` for encrypted credentials
- If found, decrypts and initializes state with saved credentials
- Sets up auto-reconnect flag if credentials exist

**State Variables:**
- `ip`, `username`, `password`, `port` - Connection credentials
- `sshKeyContent`, `passphrase` - SSH key authentication
- `status` - Connection status (`disconnected`, `connecting`, `connected`, etc.)
- `socket` - Main Socket.IO connection instance
- `sessionId` - Server-assigned session identifier
- `connections` - Array of recent connections from database

**Credential Encryption:**
- Uses XOR-based obfuscation with session-specific key
- Key stored in `sessionStorage` as `novaterm_encryption_key`
- Credentials stored as `novaterm_ssh_credentials`
- Sensitive fields (password, passphrase, SSH key) are encrypted

---

## Connection Methods

### 1. Manual Connection (SSH Connection Form)

**Location:** `components/app/ssh-connection.tsx`

**Flow:**
1. User fills in connection form (IP, port, username, password, optional SSH key)
2. User clicks "Connect" button
3. Calls `onConnect()` which maps to `connect()` from socket context
4. `connect()` is called without `connectionData` parameter, uses current state values

### 2. Recent Connection - Fill Button

**Location:** `components/app/recent-connections.tsx`

**Flow:**
1. User clicks "Fill" button on a recent connection
2. Calls `onUseConnection(conn)` which maps to `useConnection()` from socket context
3. `useConnection()` updates form fields:
   - Sets `ip`, `port`, `username` from connection
   - Sets `password` if available in connection object
4. User must manually click "Connect" after fields are filled

### 3. Recent Connection - Connect Button

**Location:** `components/app/recent-connections.tsx`

**Flow:**
1. User clicks "Connect" button on a recent connection
2. Calls `onConnect(conn)` which maps to `connectWithConnection()` from socket context
3. `connectWithConnection()`:
   - If connection doesn't have password, fetches it from `/api/connections?includePassword=true`
   - Updates context state with connection credentials (ensures terminals have access)
   - Calls `connect()` with connection data

### 4. Auto-Reconnect on Page Load

**Location:** `contexts/socket-context.tsx` (useEffect hook)

**Flow:**
1. On component mount, checks if credentials exist in `sessionStorage`
2. If credentials found and not already auto-connected:
   - Sets `hasAutoConnected.current = true`
   - Waits 500ms for components to mount
   - Calls `connect()` with `isAutoReconnect = true`
   - Uses existing `sessionId` if available for session restoration

---

## Connection Flow

### Main Connection Process (`connect()` function)

**Step 1: Cleanup Existing Connection**
```
- If socketRef.current exists:
  - Remove all event listeners
  - Disconnect socket
  - Clear socket reference
```

**Step 2: Prepare Connection Data**
```
- Determine connection parameters:
  - Use connectionData if provided (from recent connection)
  - Otherwise use current state values (from form)
- Capture: ip, port, username, password, sshKeyContent, passphrase
- Store existing sessionId if reconnecting
```

**Step 3: Create Socket.IO Connection**
```
- Create new Socket.IO instance: io(socketUrl, { transports: ['websocket'] })
- Store in socketRef.current and setSocket()
- Set status to 'connecting' (or 'reconnecting' if auto-reconnect)
```

**Step 4: Setup Socket Event Handlers**

**On `connect` event:**
- If auto-reconnecting with existing sessionId:
  - Emit `reconnectSession` with sessionId
- Otherwise:
  - Emit `startSSHConnection` with credentials

**On `ssh.sessionId` event:**
- Store sessionId in ref and state
- Save encrypted credentials to sessionStorage (including sessionId)

**On `ssh.reconnected` event:**
- Show success toast: "Session Restored"

**On `ssh.sessionExpired` event:**
- Clear sessionId
- Emit new `startSSHConnection` (create fresh session)
- Show toast: "Session Expired"

**On `ssh.status` event:**
- Update status state
- If status is "SSH connected":
  - Set status to "connected"
  - Show success toast (unless auto-reconnect)

**On `ssh.error` event:**
- Set status to "disconnected"
- Show error toast
- If auto-reconnect, clear credentials to prevent retry loop

**On `disconnect` event:**
- Set status to "disconnected"
- Show toast: "Disconnected - Session preserved for 5 minutes"

**On `connect_error` event:**
- Set status to "disconnected"
- Show error toast
- If auto-reconnect, clear credentials

**Step 5: Save Connection History**
```
- If not auto-reconnect:
  - POST to /api/connections
  - Save connection to database for recent connections list
```

---

## Terminal Tab Connections

### Terminal Tab Creation (`terminal-section.tsx`)

**When a terminal tab is created:**

1. **Tab Initialization:**
   - Creates new xterm.js Terminal instance
   - Loads addons: FitAddon, SearchAddon, WebLinksAddon
   - Creates dedicated Socket.IO connection for this tab
   - Each tab has its own independent socket connection

2. **Tab Socket Connection:**
   ```
   - Creates: io(socketHost, { transports: ['websocket'] })
   - Tab socket is separate from main socket
   ```

3. **On Tab Socket `connect` event:**
   - Checks if credentials exist in context (`ip`, `username`)
   - If missing: Shows error "Missing SSH credentials. Please connect first."
   - If present: Emits `startSSHConnection` with credentials from context

4. **Tab Socket Event Handlers:**
   - `ssh.sessionId`: Stores sessionId for this tab
   - `ssh.status`: Updates tab status, shows "Connected" message
   - `ssh.error`: Shows error message in terminal
   - `output`: Writes data to terminal
   - `disconnect`: Shows "Disconnected" message
   - `connect_error`: Shows "Connection failed" message

5. **Input Handling:**
   - Terminal input → `tabSocket.emit('input', data)`
   - Terminal resize → `tabSocket.emit('resize', { rows, cols })`

6. **Auto-Create Tab on Connection:**
   - When main status becomes "connected" and no tabs exist:
   - Automatically creates first terminal tab

### Terminal Tab Cleanup

**When global status becomes "disconnected":**
```
- For each terminal tab:
  1. Emit 'endSession' to server
  2. Call tab.cleanup() (removes listeners, disconnects socket, disposes terminal)
  3. Remove DOM container
- Clear all tabs from state
- Reset activeTabId
```

**When tab is manually closed:**
```
- Call tab.cleanup()
- Remove from tabs array
- Remove DOM container
- Update activeTabId if needed
```

---

## Disconnection Flow

### Manual Disconnect (`disconnect()` function)

**Location:** `contexts/socket-context.tsx`

**Process:**
1. If socket exists:
   - Emit `endSession` to server (terminates SSH session)
   - Remove all event listeners
   - Disconnect socket
2. Clear socket reference: `setSocket(null)`
3. Set status to "disconnected"
4. Clear sessionId (ref and state)
5. **Clear saved credentials from sessionStorage**
   - Removes `novaterm_ssh_credentials`
   - Removes `novaterm_encryption_key`

**Cascade Effect:**
- Terminal tabs detect status change to "disconnected"
- All terminal tabs are cleaned up (see Terminal Tab Cleanup above)
- All tab sockets emit `endSession` and disconnect

### Automatic Disconnect

**Triggers:**
- Socket.IO connection error
- SSH connection error
- Server-side disconnect
- Network issues

**Behavior:**
- Status set to "disconnected"
- Socket disconnected
- **Credentials preserved** (unlike manual disconnect)
- Session preserved on server for 5 minutes
- Can auto-reconnect if page reloaded within 5 minutes

---

## Reconnection & Session Management

### Session ID Management

**Session Lifecycle:**
1. **New Connection:**
   - Server creates SSH session
   - Server assigns unique sessionId
   - Client receives via `ssh.sessionId` event
   - SessionId saved with encrypted credentials

2. **Session Persistence:**
   - Server maintains session for 5 minutes after disconnect
   - SessionId stored in sessionStorage
   - Allows reconnection to same SSH session

3. **Session Reconnection:**
   - On auto-reconnect, if sessionId exists:
     - Emit `reconnectSession` with sessionId
     - Server attempts to restore existing session
     - If successful: `ssh.reconnected` event
     - If expired: `ssh.sessionExpired` event → create new session

4. **Session Expiration:**
   - If session expired (>5 minutes):
     - Server sends `ssh.sessionExpired`
     - Client clears sessionId
     - Client creates new SSH connection
     - New sessionId assigned

### Auto-Reconnect Logic

**Conditions:**
- Page reload/refresh
- Credentials exist in sessionStorage
- Hasn't already auto-connected in this session
- Credentials have valid ip and username

**Process:**
1. Check `hasAutoConnected.current` flag
2. Check `shouldAutoConnect.current` (set if initialCreds exist)
3. Wait 500ms for components to mount
4. Call `connect()` with:
   - Connection data from initialCreds
   - `isAutoReconnect = true`
5. If sessionId exists, attempt session restoration
6. Otherwise, create new connection

---

## Credential Storage

### Storage Location
- **Type:** `sessionStorage` (browser session only)
- **Keys:**
  - `novaterm_encryption_key`: Session-specific encryption key
  - `novaterm_ssh_credentials`: Encrypted credential object

### Encryption Method
- **Algorithm:** XOR-based obfuscation
- **Key:** 32-byte random hex string (generated per session)
- **Encrypted Fields:** password, passphrase, sshKeyContent
- **Plain Fields:** ip, port, username, sessionId

### Credential Object Structure
```typescript
{
  ip: string,
  port: number,
  username: string,
  password: string (encrypted),
  sshKeyContent: string | null (encrypted),
  passphrase: string (encrypted),
  sessionId: string | null
}
```

### Credential Lifecycle

**Save:**
- After successful SSH connection
- When `ssh.sessionId` event received
- Includes sessionId for reconnection

**Load:**
- On app initialization
- Decrypted and used to populate form fields
- Used for auto-reconnect

**Clear:**
- On manual disconnect (user clicks Disconnect)
- On connection errors during auto-reconnect
- On SSH errors during auto-reconnect

**Preserve:**
- On automatic disconnect (network issues, etc.)
- Allows reconnection within 5 minutes

---

## Connection State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Initiates Connection                │
│  (Form Connect / Recent Connect / Auto-Reconnect)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Socket Context: connect()                      │
│  - Cleanup existing socket                                  │
│  - Create new Socket.IO connection                          │
│  - Setup event handlers                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Socket.IO: connect event                            │
│  - If reconnecting: emit reconnectSession                  │
│  - Otherwise: emit startSSHConnection                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Server: SSH Connection                         │
│  - Establishes SSH connection                               │
│  - Creates/restores session                                 │
│  - Returns sessionId                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Client: ssh.sessionId event                         │
│  - Store sessionId                                          │
│  - Save encrypted credentials to sessionStorage             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Client: ssh.status = "SSH connected"                │
│  - Set status to "connected"                                │
│  - Show success toast                                       │
│  - Auto-create terminal tab (if none exists)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Terminal Tab Creation                           │
│  - Create xterm.js terminal                                 │
│  - Create dedicated tab socket                              │
│  - Connect tab socket                                       │
│  - Emit startSSHConnection with credentials                │
│  - Receive output, send input                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Disconnection State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              User Clicks Disconnect                         │
│         OR Automatic Disconnect (error/network)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Socket Context: disconnect()                        │
│  - Emit endSession to server                                │
│  - Disconnect socket                                        │
│  - Clear sessionId                                          │
│  - Clear credentials (manual only)                          │
│  - Set status to "disconnected"                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│    Terminal Section: Detects status = "disconnected"        │
│  - For each terminal tab:                                   │
│    * Emit endSession                                        │
│    * Call cleanup()                                         │
│    * Remove DOM container                                   │
│  - Clear all tabs                                           │
│  - Reset activeTabId                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

1. **Two Socket Types:**
   - **Main Socket:** Managed by SocketContext, handles connection status
   - **Tab Sockets:** Each terminal tab has its own socket for I/O

2. **Credential Synchronization:**
   - Recent connection "Connect" button updates context state before connecting
   - Ensures terminal tabs have credentials available immediately

3. **Session Management:**
   - Sessions preserved for 5 minutes on server
   - Auto-reconnect attempts to restore existing session
   - Falls back to new connection if session expired

4. **Cleanup:**
   - Manual disconnect: Clears everything (credentials, sessions)
   - Automatic disconnect: Preserves credentials for reconnection

5. **Terminal Tabs:**
   - Independent connections per tab
   - All cleaned up when main connection disconnects
   - Auto-created when connection succeeds
