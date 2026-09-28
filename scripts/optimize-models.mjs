import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const models = ["interviewer", "interviewee"];
const targetIndices = 750_000;
const maxError = 0.005;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);

for (const model of models) {
  const input = readFileSync(new URL(`../assets/${model}.glb`, import.meta.url));
  const jsonLength = input.readUInt32LE(12);
  const gltf = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;

  const decode = (index) => {
    const extension = gltf.bufferViews[index].extensions.EXT_meshopt_compression;
    const source = input.subarray(
      binStart + extension.byteOffset,
      binStart + extension.byteOffset + extension.byteLength,
    );
    const target = new Uint8Array(extension.count * extension.byteStride);
    MeshoptDecoder.decodeGltfBuffer(
      target,
      extension.count,
      extension.byteStride,
      source,
      extension.mode,
      extension.filter,
    );
    return target;
  };

  const indexBytes = decode(3);
  const vertexBuffers = [decode(4), decode(5), decode(6)];
  const originalIndices = new Uint32Array(
    indexBytes.buffer,
    indexBytes.byteOffset,
    indexBytes.byteLength / 4,
  );
  const vertexCount = gltf.accessors[2].count;
  const positions = new Float32Array(vertexCount * 3);
  const positionView = new DataView(vertexBuffers[1].buffer);
  for (let i = 0; i < vertexCount; i++) {
    for (let axis = 0; axis < 3; axis++) {
      positions[i * 3 + axis] = positionView.getInt16(i * 8 + axis * 2, true) / 32767;
    }
  }

  const [indices, error] = MeshoptSimplifier.simplify(
    originalIndices,
    positions,
    3,
    targetIndices,
    maxError,
    ["Prune"],
  );
  const [remap, uniqueVertices] = MeshoptSimplifier.compactMesh(indices);
  const compacted = vertexBuffers.map((buffer, bufferIndex) => {
    const stride = gltf.bufferViews[bufferIndex + 4].byteStride;
    const output = new Uint8Array(uniqueVertices * stride);
    for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
      const newIndex = remap[oldIndex];
      if (newIndex !== 0xffffffff) {
        output.set(buffer.subarray(oldIndex * stride, (oldIndex + 1) * stride), newIndex * stride);
      }
    }
    return output;
  });

  const chunks = [];
  let compressedLength = 0;
  const addChunk = (bytes) => {
    const offset = compressedLength;
    chunks.push(Buffer.from(bytes));
    compressedLength += bytes.length;
    const padding = (4 - (compressedLength % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      compressedLength += padding;
    }
    return offset;
  };

  for (let i = 0; i < 3; i++) {
    const view = gltf.bufferViews[i];
    const bytes = input.subarray(
      binStart + view.byteOffset,
      binStart + view.byteOffset + view.byteLength,
    );
    view.byteOffset = addChunk(bytes);
  }

  let decodedOffset = 0;
  const outputs = [new Uint8Array(indices.buffer), ...compacted];
  for (let i = 0; i < outputs.length; i++) {
    const index = i + 3;
    const view = gltf.bufferViews[index];
    const extension = view.extensions.EXT_meshopt_compression;
    const bytes = outputs[i];
    const count = i === 0 ? indices.length : uniqueVertices;
    const stride = i === 0 ? 4 : view.byteStride;
    const mode = i === 0 ? "TRIANGLES" : "ATTRIBUTES";
    const encoded = MeshoptEncoder.encodeGltfBuffer(bytes, count, stride, mode);

    const decoded = new Uint8Array(bytes.length);
    MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, encoded, mode);
    // Triangle encoding may cyclically rotate a triangle's three indices.
    // That keeps the same vertices and winding, so compare triangles as cycles.
    const valid =
      i === 0
        ? new Uint32Array(decoded.buffer).every((value, offset, decodedIndices) => {
            const start = Math.floor(offset / 3) * 3;
            const original = indices.subarray(start, start + 3);
            return [0, 1, 2].some((rotation) =>
              [0, 1, 2].every(
                (axis) => decodedIndices[start + axis] === original[(axis + rotation) % 3],
              ),
            );
          })
        : decoded.every((byte, offset) => byte === bytes[offset]);
    if (!valid) {
      throw new Error(`${model}: buffer ${index} failed round-trip validation`);
    }

    view.byteOffset = decodedOffset;
    view.byteLength = bytes.length;
    extension.byteOffset = addChunk(encoded);
    extension.byteLength = encoded.length;
    extension.count = count;
    extension.byteStride = stride;
    extension.mode = mode;
    delete extension.filter;
    decodedOffset += bytes.length;
  }

  gltf.accessors[0].count = indices.length;
  for (let i = 1; i < gltf.accessors.length; i++) gltf.accessors[i].count = uniqueVertices;
  gltf.buffers[0].byteLength = compressedLength;
  gltf.buffers[1].byteLength = decodedOffset;

  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadding = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const binChunk = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.write("JSON", 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.write("BIN\0", 4);

  const output = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
  writeFileSync(new URL(`../public/${model}.glb`, import.meta.url), output);
  console.log(
    `${model}: ${(input.length / 1_000_000).toFixed(2)} MB → ${(output.length / 1_000_000).toFixed(2)} MB; ` +
      `${(originalIndices.length / 3).toLocaleString()} → ${(indices.length / 3).toLocaleString()} triangles; ` +
      `error ${error.toFixed(5)}`,
  );
}
