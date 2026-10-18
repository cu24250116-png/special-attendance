// Realtime Server-Sent Events (SSE) Hub

class RealtimeHub {
  constructor() {
    this.clients = new Set();
    this.startHeartbeat();
  }

  // Register client SSE connection
  addClient(req, res, metadata = {}) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const client = {
      id: clientId,
      res,
      cuId: metadata.cuId ? metadata.cuId.toUpperCase().trim() : null,
      role: metadata.role || 'guest',
      connectedAt: new Date().toISOString(),
    };

    this.clients.add(client);

    // Send initial handshake
    this.sendToClient(client, 'connected', {
      clientId,
      message: 'Connected to College Realtime Attendance Stream',
      serverTime: new Date().toISOString(),
    });

    req.on('close', () => {
      this.clients.delete(client);
    });

    return client;
  }

  // Send SSE message to a single client
  sendToClient(client, event, data) {
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      this.clients.delete(client);
    }
  }

  // Broadcast to all clients
  broadcast(event, data) {
    const payload = {
      ...data,
      broadcastTime: new Date().toISOString(),
    };
    for (const client of this.clients) {
      this.sendToClient(client, event, payload);
    }
  }

  // Broadcast data update to a specific student
  notifyStudent(cuId, data = {}) {
    const target = cuId.toUpperCase().trim();
    for (const client of this.clients) {
      if (client.cuId === target || client.role === 'admin') {
        this.sendToClient(client, 'student_updated', {
          cuId: target,
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Broadcast to all students and admins that college records were updated
  broadcastCollegeUpdate(summary = {}) {
    this.broadcast('college_data_updated', {
      message: 'College attendance and assignments data have been updated by administration.',
      summary,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast a new notice / announcement to students and admins
  broadcastAdminMessage(messageData = {}) {
    this.broadcast('admin_message', {
      ...messageData,
      timestamp: new Date().toISOString(),
    });
  }

  // Heartbeat to keep connection active
  startHeartbeat() {
    setInterval(() => {
      for (const client of this.clients) {
        try {
          client.res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (err) {
          this.clients.delete(client);
        }
      }
    }, 20000);
  }

  getClientStats() {
    let studentClients = 0;
    let adminClients = 0;
    for (const client of this.clients) {
      if (client.role === 'admin') adminClients++;
      else if (client.cuId) studentClients++;
    }
    return {
      totalConnected: this.clients.size,
      studentClients,
      adminClients,
    };
  }
}

export const realtimeHub = new RealtimeHub();
export default realtimeHub;
