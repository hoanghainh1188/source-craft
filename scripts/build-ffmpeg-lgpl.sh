#!/usr/bin/env bash
# Dựng FFmpeg bản LGPL TỐI GIẢN (chỉ tách audio → wav 16kHz mono) cho SourceCraft.
# Vì sao tự dựng: binary dựng sẵn của `ffmpeg-static` bật cờ GPL và nonfree ⇒ KHÔNG phân phối lại được.
# Bản này: --disable-gpl --disable-nonfree, không thư viện ngoài (chỉ codec native của FFmpeg) ⇒ LGPL-2.1+.
# Đầu ra: build/ffmpeg/ffmpeg[.exe]  (+ build/ffmpeg/FFMPEG-BUILD.txt để audit cấu hình).
# Chạy trên mac/Linux hoặc MSYS2 (Windows). Cần: curl, tar, make, trình biên dịch C, shasum|sha256sum.
set -euo pipefail

FFMPEG_VERSION="7.1.1"
FFMPEG_SHA256="733984395e0dbbe5c046abda2dc49a5544e7e0e1e2366bba849222ae9e3a03b1"
URL="https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/build/ffmpeg"
WORK="${FFMPEG_WORKDIR:-$(mktemp -d)}"
JOBS="$( (nproc || sysctl -n hw.ncpu) 2>/dev/null || echo 2 )"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

mkdir -p "$OUT" "$WORK"
cd "$WORK"
if [ ! -f "ffmpeg-${FFMPEG_VERSION}.tar.xz" ]; then curl -fsSL -o "ffmpeg-${FFMPEG_VERSION}.tar.xz" "$URL"; fi
[ "$(sha256 "ffmpeg-${FFMPEG_VERSION}.tar.xz")" = "$FFMPEG_SHA256" ] || { echo "SHA256 FFmpeg không khớp — dừng." >&2; exit 1; }
rm -rf "ffmpeg-${FFMPEG_VERSION}" && tar xf "ffmpeg-${FFMPEG_VERSION}.tar.xz"
cd "ffmpeg-${FFMPEG_VERSION}"

# Danh sách tối thiểu: container phổ biến của video/audio người dùng (mp4/mov/mkv/webm/avi/ogg/wav/mp3/flac/aac/flv/wma)
# + decoder native (LGPL) của các codec audio đi kèm; xuất pcm_s16le/wav; lọc resample/đổi kênh.
./configure \
  --disable-gpl --disable-nonfree --disable-version3 --disable-autodetect \
  --disable-everything --disable-doc --disable-debug --disable-network \
  --disable-ffplay --disable-ffprobe --enable-ffmpeg \
  --disable-shared --enable-static \
  --disable-x86asm \
  --enable-protocol=file,pipe \
  --enable-demuxer=mov,matroska,avi,ogg,wav,mp3,flac,aac,flv,asf,mpegts,mpegps,ac3,eac3 \
  --enable-parser=aac,aac_latm,mpegaudio,flac,vorbis,opus,ac3,h264,hevc,vp8,vp9,av1 \
  --enable-decoder=aac,aac_latm,mp3,mp3float,mp2,opus,vorbis,flac,ac3,eac3,wmav1,wmav2,alac,pcm_s16le,pcm_s16be,pcm_s24le,pcm_s32le,pcm_f32le,pcm_u8,pcm_alaw,pcm_mulaw \
  --enable-muxer=wav --enable-encoder=pcm_s16le \
  --enable-filter=aresample,aformat,anull,atrim \
  --enable-bsf=aac_adtstoasc \
  > configure.log 2>&1 || { tail -30 configure.log >&2; exit 1; }

# Kiểm chốt: cấu hình KHÔNG được bật gpl/nonfree.
if grep -qE '^#define CONFIG_(GPL|NONFREE) 1' config.h; then echo "Cấu hình lọt GPL/nonfree — dừng." >&2; exit 1; fi

# Windows (MSYS2/MinGW): mục tiêu make và tệp ra có đuôi .exe.
EXE=""; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXE=".exe" ;; esac
make -j"$JOBS" "ffmpeg$EXE" >/dev/null
BIN="ffmpeg$EXE"
cp "$BIN" "$OUT/$BIN"
strip "$OUT/$BIN" 2>/dev/null || true
{
  echo "FFmpeg $FFMPEG_VERSION (LGPL build tối giản)"
  echo "Nguồn: $URL  sha256=$FFMPEG_SHA256"
  "$OUT/$BIN" -version | sed -n '1,2p;/configuration/p'
} > "$OUT/FFMPEG-BUILD.txt"
cp COPYING.LGPLv2.1 "$OUT/COPYING.LGPLv2.1"
echo "OK → $OUT/$BIN"
