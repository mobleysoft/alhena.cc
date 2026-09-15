#!/usr/bin/env python3
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/models/paradise-shoreline.glb"


class Builder:
    def __init__(self):
        self.positions = []
        self.normals = []
        self.indices = []
        self.primitives = []

    def add_mesh(self, name, verts, normals, faces, material):
        start_vertex = len(self.positions) // 3
        start_index = len(self.indices)
        self.positions.extend([v for p in verts for v in p])
        self.normals.extend([v for n in normals for v in n])
        for face in faces:
            self.indices.extend([start_vertex + i for i in face])
        self.primitives.append({
            "name": name,
            "material": material,
            "vertex_start": start_vertex,
            "vertex_count": len(verts),
            "index_start": start_index,
            "index_count": len(faces) * 3,
        })


def terrain(builder):
    cols, rows = 96, 42
    verts, normals, faces = [], [], []
    for r in range(rows):
        zt = r / (rows - 1)
        z = -5.8 + zt * 28.0
        for c in range(cols):
            xt = c / (cols - 1)
            x = -36.0 + xt * 72.0
            dune = math.sin(x * 0.17) * 0.10 + math.sin((x + z) * 0.115) * 0.08
            wet = max(0.0, min(1.0, (6.2 - z) / 10.0))
            berm = math.exp(-((z - 8.8) ** 2) / 9.5) * (0.18 + 0.08 * math.sin(x * 0.31))
            h = -0.145 + dune * (1.0 - wet * 0.85) + berm
            verts.append((x, h, z))
            normals.append((0.0, 1.0, 0.0))
    for r in range(rows - 1):
        for c in range(cols - 1):
            a = r * cols + c
            faces.append((a, a + 1, a + cols))
            faces.append((a + 1, a + cols + 1, a + cols))
    builder.add_mesh("sculpted-dune-wet-sand-terrain", verts, normals, faces, 0)


def box(builder, name, center, size, material):
    cx, cy, cz = center
    sx, sy, sz = (v * 0.5 for v in size)
    corners = [
        (cx - sx, cy - sy, cz - sz), (cx + sx, cy - sy, cz - sz), (cx + sx, cy + sy, cz - sz), (cx - sx, cy + sy, cz - sz),
        (cx - sx, cy - sy, cz + sz), (cx + sx, cy - sy, cz + sz), (cx + sx, cy + sy, cz + sz), (cx - sx, cy + sy, cz + sz),
    ]
    face_defs = [
        ((0, 1, 2, 3), (0, 0, -1)), ((5, 4, 7, 6), (0, 0, 1)),
        ((4, 0, 3, 7), (-1, 0, 0)), ((1, 5, 6, 2), (1, 0, 0)),
        ((3, 2, 6, 7), (0, 1, 0)), ((4, 5, 1, 0), (0, -1, 0)),
    ]
    verts, normals, faces = [], [], []
    for ids, normal in face_defs:
        base = len(verts)
        verts.extend([corners[i] for i in ids])
        normals.extend([normal] * 4)
        faces.append((base, base + 1, base + 2))
        faces.append((base, base + 2, base + 3))
    builder.add_mesh(name, verts, normals, faces, material)


def add_details(builder):
    # Authored low-cost meshes that add material separation without replacing the live gameplay.
    box(builder, "wet-sand-reflection-ribbon", (-10.0, -0.078, -2.0), (48.0, 0.025, 1.1), 1)
    box(builder, "foam-lace-waterline", (0.0, -0.045, -4.65), (68.0, 0.018, 0.10), 2)
    for i in range(18):
        x = -24 + (i * 2.83) % 48
        z = -4.25 + math.sin(i * 1.9) * 0.22
        box(builder, f"broken-foam-packet-{i:02d}", (x, -0.035, z), (0.72 + (i % 4) * 0.14, 0.016, 0.052), 2)
    for i in range(24):
        x = -30 + (i * 5.37) % 60
        z = 3.5 + (i * 3.11) % 16
        scale = 0.045 + (i % 5) * 0.012
        box(builder, f"pbr-shell-pebble-{i:02d}", (x, 0.018, z), (scale * 2.8, scale * 0.44, scale * 1.6), 3 if i % 3 else 4)


def write_glb(builder):
    materials = [
        {"name": "pbr_warm_sculpted_sand", "pbrMetallicRoughness": {"baseColorFactor": [0.82, 0.62, 0.28, 1], "roughnessFactor": 0.96, "metallicFactor": 0.0}},
        {"name": "pbr_wet_sand_reflection", "pbrMetallicRoughness": {"baseColorFactor": [0.55, 0.62, 0.52, 0.42], "roughnessFactor": 0.24, "metallicFactor": 0.02}, "alphaMode": "BLEND"},
        {"name": "pbr_shore_foam_lace", "pbrMetallicRoughness": {"baseColorFactor": [0.86, 0.98, 0.95, 0.62], "roughnessFactor": 0.34, "metallicFactor": 0.0}, "alphaMode": "BLEND"},
        {"name": "pbr_shell_ivory", "pbrMetallicRoughness": {"baseColorFactor": [0.95, 0.82, 0.55, 1], "roughnessFactor": 0.55, "metallicFactor": 0.0}},
        {"name": "pbr_pebble_dark", "pbrMetallicRoughness": {"baseColorFactor": [0.30, 0.25, 0.19, 1], "roughnessFactor": 0.90, "metallicFactor": 0.0}},
    ]
    pos_bytes = struct.pack("<%sf" % len(builder.positions), *builder.positions)
    normal_bytes = struct.pack("<%sf" % len(builder.normals), *builder.normals)
    index_bytes = struct.pack("<%sI" % len(builder.indices), *builder.indices)
    chunks, views = [], []
    offset = 0
    for payload, target in [(pos_bytes, 34962), (normal_bytes, 34962), (index_bytes, 34963)]:
        pad = (-len(payload)) % 4
        chunks.append(payload + (b"\0" * pad))
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(payload), "target": target})
        offset += len(payload) + pad
    blob = b"".join(chunks)
    accessors = [
        {"bufferView": 0, "componentType": 5126, "count": len(builder.positions) // 3, "type": "VEC3", "min": [min(builder.positions[0::3]), min(builder.positions[1::3]), min(builder.positions[2::3])], "max": [max(builder.positions[0::3]), max(builder.positions[1::3]), max(builder.positions[2::3])]},
        {"bufferView": 1, "componentType": 5126, "count": len(builder.normals) // 3, "type": "VEC3"},
        {"bufferView": 2, "componentType": 5125, "count": len(builder.indices), "type": "SCALAR"},
    ]
    meshes = [{
        "name": "paradise-authored-shoreline-enhancement",
        "primitives": [
            {
                "attributes": {"POSITION": 0, "NORMAL": 1},
                "indices": 2,
                "material": p["material"],
                "mode": 4,
                "extras": {"name": p["name"], "indexStart": p["index_start"], "indexCount": p["index_count"]}
            }
            for p in builder.primitives
        ]
    }]
    # GLTF cannot offset primitives inside a shared accessor cleanly without extra accessors.
    # For loader compatibility, emit one combined material-0 terrain mesh plus named extras.
    meshes[0]["primitives"] = [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0, "mode": 4}]
    gltf = {
        "asset": {"version": "2.0", "generator": "Paradise stdlib shoreline generator"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "paradise-shoreline-authored-glb", "mesh": 0}],
        "meshes": meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": views,
        "accessors": accessors
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(blob)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(
        b"glTF" + struct.pack("<II", 2, total) +
        struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes +
        struct.pack("<I4s", len(blob), b"BIN\0") + blob
    )
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KiB)")


def main():
    builder = Builder()
    terrain(builder)
    add_details(builder)
    write_glb(builder)


if __name__ == "__main__":
    main()
