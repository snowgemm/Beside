'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const assetSource = fs.readFileSync(path.join(root, 'js', 'assets.js'), 'utf8');
const sandbox = {
  window: { Game: { audio: { play() {} } } },
  Promise, ArrayBuffer, Uint8Array, Uint32Array, Float32Array, Math,
  setTimeout, clearTimeout, setInterval, clearInterval
};
vm.runInNewContext(assetSource, sandbox, { filename: 'js/assets.js' });
const manifest = sandbox.window.Game.assets.manifest.models;
const entries = Object.entries(manifest).filter(([, def]) => def.url && def.blobSha);
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function gitBlobSha(buffer) {
  const header = Buffer.from('blob ' + buffer.length + '\0', 'ascii');
  return crypto.createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex');
}

function readImageInfo(bytes, mimeType) {
  const b = Buffer.from(bytes);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: 'PNG', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X' && b.length >= 30) {
      return { format: 'WebP', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
    if (kind === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
      const w = 1 + (b[21] | ((b[22] & 0x3f) << 8));
      const h = 1 + (((b[22] & 0xc0) >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10));
      return { format: 'WebP', width: w, height: h };
    }
    return { format: 'WebP', width: null, height: null };
  }
  if (b.length >= 80 && b.toString('hex', 0, 12) === 'ab4b5458203230bb0d0a1a0a') {
    return { format: 'KTX2', width: b.readUInt32LE(20), height: b.readUInt32LE(24) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let p = 2;
    while (p + 4 < b.length) {
      if (b[p] !== 0xff) { p++; continue; }
      let marker = b[p + 1];
      p += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > b.length) break;
      const len = b.readUInt16BE(p);
      if (len < 2 || p + len > b.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { format: 'JPEG', height: b.readUInt16BE(p + 3), width: b.readUInt16BE(p + 5) };
      }
      p += len;
    }
  }
  return { format: mimeType || 'unknown', width: null, height: null };
}

function parseGlb(buffer) {
  const b = Buffer.from(buffer);
  if (b.length < 20 || b.toString('ascii', 0, 4) !== 'glTF') throw new Error('Invalid GLB magic/header');
  const version = b.readUInt32LE(4);
  const declaredLength = b.readUInt32LE(8);
  if (version !== 2) throw new Error('Expected GLB v2; found ' + version);
  if (declaredLength !== b.length) throw new Error('GLB length header does not match downloaded byte length');
  let offset = 12, json = null, bin = null, chunkCount = 0;
  while (offset + 8 <= b.length) {
    const length = b.readUInt32LE(offset);
    const type = b.readUInt32LE(offset + 4);
    offset += 8;
    if (length < 0 || offset + length > b.length) throw new Error('Invalid GLB chunk range');
    const chunk = b.subarray(offset, offset + length);
    if (type === CHUNK_JSON) json = JSON.parse(chunk.toString('utf8').replace(/[\0\s]+$/g, ''));
    else if (type === CHUNK_BIN) bin = chunk;
    offset += length;
    chunkCount++;
  }
  if (!json || !bin) throw new Error('GLB must contain JSON and BIN chunks');
  if (!json.asset || !String(json.asset.version).startsWith('2.')) throw new Error('glTF JSON is not version 2.x');
  if (json.buffers && json.buffers.some(x => x.uri)) throw new Error('GLB contains external buffer URI; audit parser expects self-contained GLB');
  return { json, bin, chunkCount };
}

function getImageBytes(image, gltf, bin) {
  if (image.bufferView !== undefined) {
    const view = gltf.bufferViews[image.bufferView];
    if (!view || (view.buffer || 0) !== 0) throw new Error('Image references a missing/non-GLB bufferView');
    return bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  }
  if (typeof image.uri === 'string' && image.uri.startsWith('data:')) {
    const comma = image.uri.indexOf(',');
    const payload = image.uri.slice(comma + 1);
    return Buffer.from(payload, image.uri.slice(0, comma).includes(';base64') ? 'base64' : 'ascii');
  }
  throw new Error('Image is external or missing embedded data');
}

function topologyCount(count, mode) {
  switch (mode === undefined ? 4 : mode) {
    case 0: return { points: count, triangles: 0, lines: 0 };
    case 1: return { points: 0, triangles: 0, lines: Math.floor(count / 2) };
    case 2: return { points: 0, triangles: 0, lines: count >= 2 ? count : 0 };
    case 3: return { points: 0, triangles: 0, lines: Math.max(0, count - 1) };
    case 4: return { points: 0, triangles: Math.floor(count / 3), lines: 0 };
    case 5:
    case 6: return { points: 0, triangles: Math.max(0, count - 2), lines: 0 };
    default: throw new Error('Unknown glTF primitive mode: ' + mode);
  }
}

function analyze(gltf, bin, name, byteLength) {
  const meshes = gltf.meshes || [];
  const nodes = gltf.nodes || [];
  const materials = gltf.materials || [];
  const textures = gltf.textures || [];
  const images = gltf.images || [];
  const accessors = gltf.accessors || [];
  const skins = gltf.skins || [];
  const animations = gltf.animations || [];
  let primitiveCount = 0, vertices = 0, triangles = 0, lines = 0, points = 0;
  let maxPrimitiveTriangles = 0, morphTargets = 0;
  const uniquePositionAccessors = new Set();
  const imageInfo = images.map((img, i) => {
    const bytes = getImageBytes(img, gltf, bin);
    const info = readImageInfo(bytes, img.mimeType || 'unknown');
    return { index: i, bytes: bytes.length, ...info };
  });
  let rgba8BaseBytes = 0, unresolvedImages = 0, largestTexturePx = 0;
  for (const texture of textures) {
    let source = texture.source;
    if (texture.extensions && texture.extensions.KHR_texture_basisu) source = texture.extensions.KHR_texture_basisu.source;
    if (source === undefined || !imageInfo[source]) { unresolvedImages++; continue; }
    const image = imageInfo[source];
    if (!image.width || !image.height) { unresolvedImages++; continue; }
    const pixels = image.width * image.height;
    largestTexturePx = Math.max(largestTexturePx, pixels);
    rgba8BaseBytes += pixels * 4;
  }
  const primitiveMaterials = new Set();
  const textureRefs = { baseColor: 0, metallicRoughness: 0, normal: 0, occlusion: 0, emissive: 0 };
  let alphaMaterials = 0, doubleSidedMaterials = 0;
  for (const material of materials) {
    if (material.alphaMode && material.alphaMode !== 'OPAQUE') alphaMaterials++;
    if (material.doubleSided) doubleSidedMaterials++;
    const pbr = material.pbrMetallicRoughness || {};
    if (pbr.baseColorTexture) textureRefs.baseColor++;
    if (pbr.metallicRoughnessTexture) textureRefs.metallicRoughness++;
    if (material.normalTexture) textureRefs.normal++;
    if (material.occlusionTexture) textureRefs.occlusion++;
    if (material.emissiveTexture) textureRefs.emissive++;
  }
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives || []) {
      primitiveCount++;
      if (primitive.material !== undefined) primitiveMaterials.add(primitive.material);
      if (primitive.targets) morphTargets += primitive.targets.length;
      const positionIndex = primitive.attributes && primitive.attributes.POSITION;
      if (positionIndex === undefined || !accessors[positionIndex]) throw new Error('Primitive is missing a POSITION accessor');
      const position = accessors[positionIndex];
      uniquePositionAccessors.add(positionIndex);
      const count = primitive.indices !== undefined
        ? accessors[primitive.indices].count
        : position.count;
      const topology = topologyCount(count, primitive.mode);
      triangles += topology.triangles;
      lines += topology.lines;
      points += topology.points;
      maxPrimitiveTriangles = Math.max(maxPrimitiveTriangles, topology.triangles);
      vertices += position.count;
    }
  }
  const bounds = [];
  for (const accessor of accessors) {
    if (accessor.min && accessor.max && accessor.type === 'VEC3') {
      const min = accessor.min, max = accessor.max;
      bounds.push([max[0]-min[0], max[1]-min[1], max[2]-min[2]]);
    }
  }
  const maxExtent = [0,1,2].map(axis => Math.max(0, ...bounds.map(v => v[axis])));
  const sceneNodes = (gltf.scenes || []).reduce((n, s) => n + (s.nodes || []).length, 0);
  const usedExtensions = gltf.extensionsUsed || [];
  const requiredExtensions = gltf.extensionsRequired || [];
  const unsupportedCandidates = requiredExtensions.filter(x =>
    ['KHR_draco_mesh_compression','KHR_texture_basisu','EXT_texture_webp','EXT_texture_avif','EXT_meshopt_compression','KHR_meshopt_compression'].includes(x)
  );
  const estimateMipBytes = Math.ceil(rgba8BaseBytes * 4 / 3);
  const texturesByFormat = {};
  for (const tex of textures) {
    let source = tex.source;
    if (tex.extensions && tex.extensions.KHR_texture_basisu) source = tex.extensions.KHR_texture_basisu.source;
    const img = imageInfo[source];
    const fmt = img ? img.format : 'unresolved';
    texturesByFormat[fmt] = (texturesByFormat[fmt] || 0) + 1;
  }
  return {
    name, bytes: byteLength, gltfVersion: gltf.asset.version,
    scenes: (gltf.scenes || []).length, rootNodes: sceneNodes, nodes: nodes.length,
    meshes: meshes.length, primitives: primitiveCount, uniqueMaterials: primitiveMaterials.size,
    materials: materials.length, vertices: vertices, triangles, lines, points,
    maxPrimitiveTriangles, skins: skins.length, animations: animations.length, morphTargets,
    attributeAccessors: uniquePositionAccessors.size,
    maxAccessorExtent: maxExtent.map(n => Number(n.toFixed(3))),
    images: images.length, textures: textures.length, imageInfo, texturesByFormat,
    textureRefs, unresolvedImages,
    textureRGBA8BaseBytes: rgba8BaseBytes,
    textureRGBA8MipEstimateBytes: estimateMipBytes,
    textureRGBA8MipEstimateMiB: Number((estimateMipBytes / 1048576).toFixed(3)),
    largestTexturePixels: largestTexturePx,
    alphaMaterials, doubleSidedMaterials,
    extensionsUsed: usedExtensions, extensionsRequired: requiredExtensions,
    compressedExtensionReviewRequired: unsupportedCandidates
  };
}

async function main() {
  if (!entries.length) throw new Error('No pinned remote GLB entries found in Game.assets.manifest.models');
  const rows = [];
  for (const [name, def] of entries) {
    if (!def.blobBytes || !def.url || !def.blobSha) throw new Error(name + ': pinned asset is missing blobBytes/url/blobSha');
    const response = await fetch(def.url, { headers: { 'user-agent': 'Beside-GLB-Audit/1.0' } });
    if (!response.ok) throw new Error(name + ': download failed with HTTP ' + response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    const actualSha = gitBlobSha(buffer);
    if (buffer.length !== def.blobBytes) throw new Error(name + ': byte size mismatch expected ' + def.blobBytes + ', got ' + buffer.length);
    if (actualSha !== def.blobSha) throw new Error(name + ': Git blob SHA mismatch expected ' + def.blobSha + ', got ' + actualSha);
    const parsed = parseGlb(buffer);
    rows.push(analyze(parsed.json, parsed.bin, name, buffer.length));
  }

  const totalBytes = rows.reduce((s, x) => s + x.bytes, 0);
  const totalTriangles = rows.reduce((s, x) => s + x.triangles, 0);
  const totalTextureBytes = rows.reduce((s, x) => s + x.textureRGBA8MipEstimateBytes, 0);
  const summary = {
    schema: 'beside.glb-audit.v1',
    auditedAt: new Date().toISOString(),
    assets: rows,
    totals: {
      assetCount: rows.length,
      downloadBytes: totalBytes,
      triangles: totalTriangles,
      textureRGBA8MipEstimateBytes: totalTextureBytes,
      textureRGBA8MipEstimateMiB: Number((totalTextureBytes / 1048576).toFixed(3)),
      primitives: rows.reduce((s, x) => s + x.primitives, 0),
      materials: rows.reduce((s, x) => s + x.materials, 0)
    }
  };
  console.log('GLB audit summary (JSON follows)');
  console.log(JSON.stringify(summary, null, 2));
  console.log('Binary integrity: ' + rows.length + '/' + rows.length + ' pinned Git blobs and sizes verified');
  if (rows.some(x => x.compressedExtensionReviewRequired.length)) {
    console.log('NOTE: one or more required compression extensions need a Three.js r128 compatibility check.');
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
