import express from "express";
import { protect } from "../middleware/auth";

import Device from "../models/Device";
import SensorReading from "../models/SensorReading";

const router = express.Router();

function isNum(v: any) {
  return typeof v === "number" && Number.isFinite(v);
}

function rangeToStart(range: string) {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return new Date(now - 24 * 60 * 60 * 1000);
}

function rangeToBucketMs(range: string) {
  if (range === "24h") return 60 * 60 * 1000; // 1 hour
  if (range === "7d") return 6 * 60 * 60 * 1000; // 6 hours
  if (range === "30d") return 24 * 60 * 60 * 1000; // 1 day
  return 60 * 60 * 1000;
}

function aqiLabel(aqi: number) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (SG)";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

router.post("/readings", async (req, res) => {
  try {
    const {
      deviceKey,
      temperatureC,
      humidityPct,
      pressureHpa,
      aqi,
      pm25,
      co2ppm,
      currentA,
      voltageV,
    } = req.body || {};

    if (!deviceKey)
      return res.status(400).json({ message: "deviceKey required" });

    const required = {
      temperatureC,
      humidityPct,
      pressureHpa,
      aqi,
      pm25,
      co2ppm,
      currentA,
      voltageV,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => !isNum(v))
      .map(([k]) => k);

    if (missing.length) {
      return res.status(400).json({
        message: `Missing/invalid numeric fields: ${missing.join(", ")}`,
      });
    }

    const device = await Device.findOne({ deviceKey }).select(
      "activeKioskId deviceKey"
    );
    const activeKioskId = device?.activeKioskId;

    await SensorReading.create({
      deviceKey,
      activeKioskId,
      temperatureC,
      humidityPct,
      pressureHpa,
      aqi,
      pm25,
      co2ppm,
      currentA,
      voltageV,
    });

    return res.status(201).json({ ok: true });
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});

router.get("/latest", protect, async (req, res) => {
  try {
    const deviceKey = String(req.query.deviceKey || "");
    if (!deviceKey)
      return res.status(400).json({ message: "deviceKey required" });

    const latestTwo = await SensorReading.find({ deviceKey })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    const latest = latestTwo[0];
    const prev = latestTwo[1];

    if (!latest) return res.json({ deviceKey, latest: null, delta: null });

    const delta = prev
      ? {
          temperatureC: +(latest.temperatureC - prev.temperatureC).toFixed(2),
          humidityPct: +(latest.humidityPct - prev.humidityPct).toFixed(2),
          pressureHpa: +(latest.pressureHpa - prev.pressureHpa).toFixed(2),
          aqi: Math.round(latest.aqi - prev.aqi),
          currentA: +(latest.currentA - prev.currentA).toFixed(2),
          voltageV: +(latest.voltageV - prev.voltageV).toFixed(2),
        }
      : null;

    return res.json({
      deviceKey,
      latest: {
        ...latest,
        aqiLabel: aqiLabel(latest.aqi),
      },
      delta,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});


router.get("/timeseries", protect, async (req, res) => {
  try {
    const deviceKey = String(req.query.deviceKey || "");
    const metric = String(req.query.metric || "temperatureC");
    const range = String(req.query.range || "24h");

    if (!deviceKey)
      return res.status(400).json({ message: "deviceKey required" });

    const allowed = new Set([
      "temperatureC",
      "humidityPct",
      "pressureHpa",
      "aqi",
      "pm25",
      "co2ppm",
      "currentA",
      "voltageV",
    ]);

    if (!allowed.has(metric)) {
      return res.status(400).json({ message: `Invalid metric: ${metric}` });
    }

    const start = rangeToStart(range);
    const bucketMs = rangeToBucketMs(range);

    const points = await SensorReading.aggregate([
      { $match: { deviceKey, createdAt: { $gte: start } } },
      { $addFields: { ts: { $toLong: "$createdAt" } } },
      {
        $addFields: {
          bucket: { $subtract: ["$ts", { $mod: ["$ts", bucketMs] }] },
        },
      },
      { $group: { _id: "$bucket", value: { $avg: `$${metric}` } } },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          t: { $toDate: "$_id" },
          value: { $round: ["$value", 2] },
        },
      },
    ]);

    return res.json({ deviceKey, metric, range, points });
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});


router.get("/air-quality", protect, async (req, res) => {
  try {
    const deviceKey = String(req.query.deviceKey || "");
    const range = String(req.query.range || "24h");

    if (!deviceKey)
      return res.status(400).json({ message: "deviceKey required" });

    const start = rangeToStart(range);
    const bucketMs = rangeToBucketMs(range);

    const points = await SensorReading.aggregate([
      { $match: { deviceKey, createdAt: { $gte: start } } },
      { $addFields: { ts: { $toLong: "$createdAt" } } },
      {
        $addFields: {
          bucket: { $subtract: ["$ts", { $mod: ["$ts", bucketMs] }] },
        },
      },
      {
        $group: {
          _id: "$bucket",
          pm25: { $avg: "$pm25" },
          co2ppm: { $avg: "$co2ppm" },
          aqi: { $avg: "$aqi" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          t: { $toDate: "$_id" },
          pm25: { $round: ["$pm25", 2] },
          co2ppm: { $round: ["$co2ppm", 0] },
          aqi: { $round: ["$aqi", 0] },
        },
      },
    ]);

    return res.json({ deviceKey, range, points });
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});

router.get("/overview/latest", protect, async (_req, res) => {
  try {
    // latest reading per device
    const latestPerDevice = await SensorReading.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$deviceKey",
          latest: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$latest" } },
    ]);

    const totalDevices = await Device.countDocuments();

    const devicesReporting = latestPerDevice.length;

    if (!latestPerDevice.length) {
      return res.json({
        totalDevices,
        devicesReporting,
        averages: null,
        worstAqi: null,
        lastUpdatedAt: null,
      });
    }

    const avg = (key: string) =>
      latestPerDevice.reduce((s: number, r: any) => s + (r[key] ?? 0), 0) /
      latestPerDevice.length;

    const averages = {
      temperatureC: +avg("temperatureC").toFixed(1),
      humidityPct: +avg("humidityPct").toFixed(0),
      pressureHpa: +avg("pressureHpa").toFixed(0),
      aqi: Math.round(avg("aqi")),
      pm25: +avg("pm25").toFixed(1),
      co2ppm: Math.round(avg("co2ppm")),
      currentA: +avg("currentA").toFixed(2),
      voltageV: +avg("voltageV").toFixed(0),
    };

    const worst = [...latestPerDevice].sort(
      (a: any, b: any) => (b.aqi ?? 0) - (a.aqi ?? 0)
    )[0];

    const lastUpdatedAt = latestPerDevice[0]?.createdAt ?? null;

    return res.json({
      totalDevices,
      devicesReporting,
      averages: { ...averages, aqiLabel: aqiLabel(averages.aqi) },
      worstAqi: worst
        ? {
            deviceKey: worst.deviceKey,
            aqi: worst.aqi,
            aqiLabel: aqiLabel(worst.aqi),
            pm25: worst.pm25,
            co2ppm: worst.co2ppm,
            createdAt: worst.createdAt,
          }
        : null,
      lastUpdatedAt,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});

router.get("/overview/timeseries", protect, async (req, res) => {
  try {
    const metric = String(req.query.metric || "temperatureC");
    const range = String(req.query.range || "24h");

    const allowed = new Set([
      "temperatureC",
      "humidityPct",
      "pressureHpa",
      "aqi",
      "pm25",
      "co2ppm",
      "currentA",
      "voltageV",
    ]);
    if (!allowed.has(metric)) {
      return res.status(400).json({ message: `Invalid metric: ${metric}` });
    }

    const start = rangeToStart(range);
    const bucketMs = rangeToBucketMs(range);

    const points = await SensorReading.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $addFields: { ts: { $toLong: "$createdAt" } } },
      {
        $addFields: {
          bucket: { $subtract: ["$ts", { $mod: ["$ts", bucketMs] }] },
        },
      },

      // ✅ average across ALL readings in the bucket (fleet-wide)
      { $group: { _id: "$bucket", value: { $avg: `$${metric}` } } },

      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          t: { $toDate: "$_id" },
          value: { $round: ["$value", 2] },
        },
      },
    ]);

    return res.json({ metric, range, points });
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});

router.get("/overview/devices", protect, async (req, res) => {
  try {
    const sort = String(req.query.sort || "last");
    const limit = Math.min(Number(req.query.limit || 20), 100);

    const latestPerDevice = await SensorReading.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$deviceKey", latest: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latest" } },
    ]);

    const sorted =
      sort === "aqi"
        ? latestPerDevice.sort((a: any, b: any) => (b.aqi ?? 0) - (a.aqi ?? 0))
        : latestPerDevice; // already newest first

    return res.json(
      sorted.slice(0, limit).map((r: any) => ({
        deviceKey: r.deviceKey,
        aqi: r.aqi,
        aqiLabel: aqiLabel(r.aqi),
        temperatureC: r.temperatureC,
        humidityPct: r.humidityPct,
        lastSeenAt: r.createdAt,
      }))
    );
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Internal server error" });
  }
});

export default router;
