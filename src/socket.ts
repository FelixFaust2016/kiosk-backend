import { Server } from "socket.io";
import { Server as HTTPServer } from "http";

let io: Server;

export const initSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    // device assignment updates
    socket.on("join-device", (deviceKey: string) => {
      socket.join(`device:${deviceKey}`);
    });

    // optional: kiosk room if you ever need it later
    socket.on("join-kiosk", (kioskId: string) => {
      socket.join(`kiosk:${kioskId}`);
    });
  });
};

export const emitDeviceUpdate = (deviceKey: string) => {
  io.to(`device:${deviceKey}`).emit("device-update");
};

// used when kiosk config changes; devices subscribed by backend logic (see below)
export const emitKioskUpdate = (kioskId: string) => {
  io.to(`kiosk:${kioskId}`).emit("kiosk-update");
};
