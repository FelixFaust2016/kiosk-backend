import mongoose, { Document } from "mongoose";

export interface ISensorReading extends Document {
  deviceKey: string;
  activeKioskId?: mongoose.Types.ObjectId;

  temperatureC: number;
  humidityPct: number;
  pressureHpa: number;

  aqi: number;
  pm25: number;
  co2ppm: number;

  currentA: number;
  voltageV: number;

  createdAt: Date;
}

const sensorReadingSchema = new mongoose.Schema<ISensorReading>(
  {
    deviceKey: { type: String, required: true, index: true },
    activeKioskId: { type: mongoose.Schema.Types.ObjectId, ref: "Playlist" },

    temperatureC: { type: Number, required: true },
    humidityPct: { type: Number, required: true },
    pressureHpa: { type: Number, required: true },

    aqi: { type: Number, required: true },
    pm25: { type: Number, required: true },
    co2ppm: { type: Number, required: true },

    currentA: { type: Number, required: true },
    voltageV: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sensorReadingSchema.index({ deviceKey: 1, createdAt: -1 });

export default mongoose.model<ISensorReading>("SensorReading", sensorReadingSchema);