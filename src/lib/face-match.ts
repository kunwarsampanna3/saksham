import "server-only";
import path from "node:path";
import sharp from "sharp";

/**
 * Real face matching for the KYC selfie step, run on our own server (no outside service).
 * Open-source models (@vladmandic/face-api, MIT) compare the face on the ID photo with the selfie.
 * Lower distance = more alike: same person is usually below 0.45, different people above 0.6.
 */
export const MATCH_BELOW = 0.5; // auto-verified
export const REVIEW_BELOW = 0.6; // between the two: a person looks at it

type FaceApi = typeof import("@vladmandic/face-api");
const g = globalThis as unknown as { __sakshamFace?: Promise<FaceApi> };

function load(): Promise<FaceApi> {
  g.__sakshamFace ??= (async () => {
    const root = process.cwd();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wasm = require("@tensorflow/tfjs-backend-wasm") as { setWasmPaths: (p: string) => void };
    wasm.setWasmPaths(path.join(root, "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist") + path.sep);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js") as FaceApi;
    const tf = faceapi.tf as unknown as {
      setBackend: (b: string) => Promise<boolean>;
      ready: () => Promise<void>;
    };
    await tf.setBackend("wasm");
    await tf.ready();
    const models = path.join(root, "node_modules", "@vladmandic", "face-api", "model");
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(models);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(models);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(models);
    return faceapi;
  })().catch((e) => {
    g.__sakshamFace = undefined;
    throw e;
  });
  return g.__sakshamFace;
}

async function faces(faceapi: FaceApi, img: Buffer) {
  const { data, info } = await sharp(img)
    .rotate()
    .resize(800, 800, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const t = faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
  try {
    return await faceapi
      .detectAllFaces(t as never, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  } finally {
    t.dispose();
  }
}

export interface FaceResult {
  idFaces: number;
  selfieFaces: number;
  distance: number | null;
}

export async function compareFaces(idPhoto: Buffer, selfie: Buffer): Promise<FaceResult> {
  const faceapi = await load();
  const [a, b] = [await faces(faceapi, idPhoto), await faces(faceapi, selfie)];
  // The biggest face on each photo is the person (an ID can have a small second print).
  const biggest = (list: typeof a) =>
    list.slice().sort((x, y) => y.detection.box.area - x.detection.box.area)[0];
  const fa = biggest(a),
    fb = biggest(b);
  return {
    idFaces: a.length,
    selfieFaces: b.length,
    distance:
      fa && fb ? Math.round(faceapi.euclideanDistance(fa.descriptor, fb.descriptor) * 1000) / 1000 : null,
  };
}
