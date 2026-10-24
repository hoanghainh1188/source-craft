import { deflateRawSync, crc32 } from "node:zlib";

// 232 — Pure Node.js OPC Zip builder for DOCX generation without external dependencies.
// Creates ISO/IEC 29500 (Open Packaging Conventions) zip archives.

export interface ZipEntry {
  path: string;
  data: Buffer | string;
}

/**
 * Creates a valid ZIP archive buffer containing the given files.
 * Uses DEFLATE compression and standard UTF-8 zip headers.
 */
export function buildZip(entries: readonly ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const cdHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, "utf8");
    const rawData = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");
    const compressed = deflateRawSync(rawData);
    const checksum = crc32(rawData);

    // Local file header (30 bytes + filename)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Local header signature
    lh.writeUInt16LE(20, 4); // Minimum version (2.0)
    lh.writeUInt16LE(0x0800, 6); // General purpose flag: UTF-8 encoding
    lh.writeUInt16LE(8, 8); // Compression: Deflate
    lh.writeUInt16LE(0, 10); // Last mod file time
    lh.writeUInt16LE(0, 12); // Last mod file date
    lh.writeUInt32LE(checksum, 14); // CRC-32
    lh.writeUInt32LE(compressed.length, 18); // Compressed size
    lh.writeUInt32LE(rawData.length, 22); // Uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26); // File name length
    lh.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    // Central directory header (46 bytes + filename)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // Central directory signature
    cd.writeUInt16LE(20, 4); // Version made by
    cd.writeUInt16LE(20, 6); // Version needed to extract
    cd.writeUInt16LE(0x0800, 8); // UTF-8
    cd.writeUInt16LE(8, 10); // Deflate
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(checksum, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(rawData.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42); // Relative offset of local header
    nameBuf.copy(cd, 46);

    cdHeaders.push(cd);
    offset += lh.length + compressed.length;
  }

  const cdBuf = Buffer.concat(cdHeaders);
  const cdOffset = offset;
  const cdSize = cdBuf.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8); // Number of central directory records on this disk
  eocd.writeUInt16LE(entries.length, 10); // Total number of central directory records
  eocd.writeUInt32LE(cdSize, 12); // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}
