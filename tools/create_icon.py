from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets"
LOGICAL_SIZE = 64
SCALE = 4
SIZE = LOGICAL_SIZE * SCALE


def draw_icon() -> bytes:
    pixels = bytearray(SIZE * SIZE * 4)

    def rect(x: int, y: int, width: int, height: int, color: tuple[int, int, int, int]) -> None:
        x, y, width, height = x * SCALE, y * SCALE, width * SCALE, height * SCALE
        for row in range(max(0, y), min(SIZE, y + height)):
            start = (row * SIZE + max(0, x)) * 4
            end = (row * SIZE + min(SIZE, x + width)) * 4
            pixels[start:end] = bytes(color) * ((end - start) // 4)

    bg = (8, 20, 28, 255)
    cyan = (73, 217, 244, 255)
    green = (112, 242, 161, 255)
    border = (24, 61, 72, 255)
    rect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE, bg)
    rect(3, 3, 58, 1, border)
    rect(3, 60, 58, 1, border)
    rect(3, 3, 1, 58, border)
    rect(60, 3, 1, 58, border)
    # Stepped cyan HUD corners give the mark its pixel-display silhouette.
    for x, y, sx, sy in ((7, 7, 1, 1), (56, 7, -1, 1), (7, 56, 1, -1), (56, 56, -1, -1)):
        rect(x, y, 9 * sx if sx > 0 else 0, 2, cyan)
        rect(x, y, 2, 9 * sy if sy > 0 else 0, cyan)
        if sx < 0:
            rect(x - 8, y, 9, 2, cyan)
        if sy < 0:
            rect(x, y - 8, 2, 9, cyan)

    # Original block-built F monogram.
    glyph = (
        "1111111",
        "1100000",
        "1100000",
        "1111110",
        "1100000",
        "1100000",
        "1100000",
    )
    cell, left, top = 4, 18, 18
    for row, line in enumerate(glyph):
        for column, value in enumerate(line):
            if value == "1":
                rect(left + column * cell, top + row * cell, cell - 1, cell - 1, green)

    # A small cyan pixel marks the current point in the focus cycle.
    rect(43, 43, 5, 5, cyan)
    rect(44, 44, 3, 3, bg)
    rect(45, 45, 1, 1, cyan)

    rows = b"".join(b"\x00" + pixels[y * SIZE * 4:(y + 1) * SIZE * 4] for y in range(SIZE))

    def chunk(name: bytes, data: bytes) -> bytes:
        body = name + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    png = draw_icon()
    (ROOT / "focus-mark.png").write_bytes(png)
    # ICO entry points at a PNG payload, supported by Windows Vista and newer.
    header = struct.pack("<HHH", 0, 1, 1)
    # A zero width/height byte means 256 pixels in an ICO directory entry.
    icon_dimension = 0 if SIZE == 256 else SIZE
    entry = struct.pack("<BBBBHHII", icon_dimension, icon_dimension, 0, 0, 1, 32, len(png), 22)
    (ROOT / "focus-mark.ico").write_bytes(header + entry + png)
    print(f"Wrote PNG ({len(png)} bytes) and ICO ({len(png) + 22} bytes) to {ROOT}")


if __name__ == "__main__":
    main()
