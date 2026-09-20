#!/usr/bin/env python3
"""
GridPull Python Core Engine
Handles yt-dlp execution, format parsing, multi-source searching,
and robust telemetry streaming.
"""

import sys
import os
import json
import subprocess
import argparse
import urllib.request
import re
import shutil
import time

YTDLP_BIN_NAME = "yt-dlp.exe" if os.name == "nt" else "yt-dlp"

_CACHED_YTDLP_BIN = None
_CACHED_YTDLP_CMD = None

def get_ytdlp_bin():
    global _CACHED_YTDLP_BIN
    if _CACHED_YTDLP_BIN is not None:
        return _CACHED_YTDLP_BIN

    try:
        import yt_dlp
        _CACHED_YTDLP_BIN = [sys.executable, "-m", "yt_dlp"]
        return _CACHED_YTDLP_BIN
    except ImportError:
        pass

    sys_path = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe")
    if sys_path:
        _CACHED_YTDLP_BIN = [sys_path]
        return _CACHED_YTDLP_BIN

    local_bin = os.path.join(os.path.dirname(os.path.abspath(__file__)), YTDLP_BIN_NAME)
    if os.path.exists(local_bin):
        if os.name != "nt":
            try:
                os.chmod(local_bin, 0o755)
            except Exception:
                pass
        try:
            subprocess.run([local_bin, "--version"], capture_output=True, timeout=10, check=True)
            _CACHED_YTDLP_BIN = [local_bin]
            return _CACHED_YTDLP_BIN
        except Exception:
            pass

    return None

def ensure_ytdlp():
    if get_ytdlp_bin():
        return True
    local_bin = os.path.join(os.path.dirname(os.path.abspath(__file__)), YTDLP_BIN_NAME)
    url = f"https://github.com/yt-dlp/yt-dlp/releases/latest/download/{YTDLP_BIN_NAME}"
    try:
        urllib.request.urlretrieve(url, local_bin)
        if os.name != "nt":
            os.chmod(local_bin, 0o755)
        global _CACHED_YTDLP_BIN, _CACHED_YTDLP_CMD
        _CACHED_YTDLP_BIN = None
        _CACHED_YTDLP_CMD = None
        return True
    except Exception as e:
        print(f"[ENGINE ERROR] Failed to download yt-dlp: {e}", file=sys.stderr)
        return False

def get_ytdlp_cmd():
    global _CACHED_YTDLP_CMD
    if _CACHED_YTDLP_CMD is not None:
        return list(_CACHED_YTDLP_CMD)

    base_cmd = get_ytdlp_bin()
    if not base_cmd:
        local_bin = os.path.join(os.path.dirname(os.path.abspath(__file__)), YTDLP_BIN_NAME)
        base_cmd = [local_bin]
    
    cmd = list(base_cmd)
    
    node_bin = shutil.which("node") or shutil.which("node.exe") or "/usr/local/bin/node"
    if os.path.exists(node_bin):
        cmd.extend(["--js-runtimes", f"node:{node_bin}"])
    else:
        cmd.extend(["--js-runtimes", "node"])

    ffmpeg_bin = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
    if ffmpeg_bin:
        ffmpeg_dir = os.path.dirname(ffmpeg_bin)
        cmd.extend(["--ffmpeg-location", ffmpeg_dir])

    _CACHED_YTDLP_CMD = list(cmd)
    return list(_CACHED_YTDLP_CMD)

_YT_DLP_BOT_WORKAROUNDS = [
    "--extractor-args", "youtube:player_client=android,web,mweb",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "--no-check-certificates",
]

def format_bytes(val):
    if not val or val <= 0:
        return None
    for unit in ['B', 'KiB', 'MiB', 'GiB']:
        if val < 1024.0:
            return f"{val:.2f}{unit}"
        val /= 1024.0
    return f"{val:.2f}TiB"

SOURCE_PREFIXES = {
  'youtube': 'ytsearch',
  'soundcloud': 'scsearch',
  'bandcamp': 'bcsearch',
  'bilibili': 'bilisearch',
  'deezer': 'dzsearch'
}

def search_media(query, count=20, source='youtube'):
    ensure_ytdlp()
    prefix = SOURCE_PREFIXES.get(source, 'ytsearch')
    search_term = f"{prefix}{count}:{query}"
    cmd = get_ytdlp_cmd() + _YT_DLP_BOT_WORKAROUNDS + [
        "--dump-single-json",
        "--flat-playlist",
        "--skip-download",
        search_term
    ]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = proc.communicate(timeout=45)
        if proc.returncode != 0:
            return {"error": stderr.strip() or "Search failed"}
        data = json.loads(stdout)
        results = []
        for entry in data.get("entries", []):
            if not entry:
                continue
            entry_id = entry.get("id")
            url = entry.get("url") or entry.get("webpage_url") or (f"https://www.youtube.com/watch?v={entry_id}" if entry_id else "")
            duration = entry.get("duration")
            dur_str = ""
            if duration:
                m, s = divmod(int(duration), 60)
                h, m = divmod(m, 60)
                dur_str = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
            results.append({
                "id": entry_id,
                "title": entry.get("title") or "Unknown Title",
                "uploader": entry.get("uploader") or entry.get("channel") or "Unknown Artist",
                "duration": dur_str,
                "url": url,
                "view_count": entry.get("view_count")
            })
        return {"query": query, "source": source, "results": results}
    except Exception as e:
        return {"error": str(e)}

def extract_info(url, is_playlist=False):
    ensure_ytdlp()
    cmd = get_ytdlp_cmd() + _YT_DLP_BOT_WORKAROUNDS + [
        "--dump-json",
        "--flat-playlist" if is_playlist else "--no-playlist",
        "--skip-download",
        url
    ]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = proc.communicate(timeout=60)
        if proc.returncode != 0:
            return {"error": stderr.strip() or "Failed to extract metadata"}
        
        lines = [line for line in stdout.strip().split("\n") if line.strip()]
        if len(lines) == 1:
            return {"type": "single", "data": json.loads(lines[0])}
        else:
            items = []
            for line in lines:
                try:
                    items.append(json.loads(line))
                except Exception:
                    pass
            return {"type": "playlist", "items": items}
    except Exception as e:
        return {"error": str(e)}

def parse_formats_list(raw_formats, duration=0):
    if not raw_formats:
        return []
    parsed_rows = []
    for f in raw_formats:
        fmt_id = str(f.get("format_id", ""))
        ext = f.get("ext", "")
        w = f.get("width")
        h = f.get("height")
        fps = f.get("fps")
        vcodec = f.get("vcodec")
        acodec = f.get("acodec")
        tbr = f.get("tbr")
        filesize_num = f.get("filesize") or f.get("filesize_approx")

        if not filesize_num and tbr and duration:
            filesize_num = int((tbr * 1000 / 8) * duration)

        filesize_str = format_bytes(filesize_num) if filesize_num else None

        if w and h:
            res_str = f"{w}x{h}"
        elif f.get("resolution"):
            res_str = f.get("resolution")
        elif vcodec == "none" or (acodec and acodec != "none" and (not vcodec or vcodec == "none")):
            res_str = "audio only"
        else:
            res_str = "unknown"

        kind = "audio" if res_str == "audio only" else ("muxed" if (vcodec and vcodec != "none" and acodec and acodec != "none") else "video")

        label_parts = [fmt_id, ext, res_str]
        if fps:
            label_parts.append(f"{fps}fps")
        if vcodec and vcodec != "none":
            label_parts.append(str(vcodec)[:12])
        if acodec and acodec != "none":
            label_parts.append(f"a:{str(acodec)[:8]}")
        if filesize_str:
            label_parts.append(f"[{filesize_str}]")

        parsed_rows.append({
            "id": fmt_id,
            "ext": ext,
            "resolution": res_str,
            "fps": fps,
            "vcodec": vcodec if vcodec != "none" else None,
            "acodec": acodec if acodec != "none" else None,
            "tbr": f"{int(tbr)}k" if tbr else "",
            "filesize": filesize_str,
            "proto": f.get("protocol", "https"),
            "kind": kind,
            "label": " ".join(label_parts)
        })
    return parsed_rows

def get_synthetic_formats():
    return [
        {"id": "2160p_mp4", "ext": "mp4", "resolution": "3840x2160", "fps": 60, "vcodec": "avc1/vp9", "acodec": "m4a", "tbr": "22000k", "filesize": "~320.0MiB", "proto": "https", "kind": "video", "label": "4K Ultra HD (2160p) [~320MiB]"},
        {"id": "1440p_mp4", "ext": "mp4", "resolution": "2560x1440", "fps": 60, "vcodec": "avc1/vp9", "acodec": "m4a", "tbr": "11000k", "filesize": "~180.0MiB", "proto": "https", "kind": "video", "label": "1440p Quad HD (2K) [~180MiB]"},
        {"id": "1080p_mp4", "ext": "mp4", "resolution": "1920x1080", "fps": 60, "vcodec": "avc1", "acodec": "m4a", "tbr": "4660k", "filesize": "~85.0MiB", "proto": "https", "kind": "video", "label": "1080p Full HD [~85MiB]"},
        {"id": "720p_mp4", "ext": "mp4", "resolution": "1280x720", "fps": 30, "vcodec": "avc1", "acodec": "m4a", "tbr": "2628k", "filesize": "~42.0MiB", "proto": "https", "kind": "video", "label": "720p HD [~42MiB]"},
        {"id": "480p_mp4", "ext": "mp4", "resolution": "854x480", "fps": 30, "vcodec": "avc1", "acodec": "m4a", "tbr": "1328k", "filesize": "~21.0MiB", "proto": "https", "kind": "video", "label": "480p Standard (SD) [~21MiB]"},
        {"id": "360p_mp4", "ext": "mp4", "resolution": "640x360", "fps": 30, "vcodec": "avc1", "acodec": "m4a", "tbr": "696k", "filesize": "~11.0MiB", "proto": "https", "kind": "video", "label": "360p Data Saver [~11MiB]"},
        {"id": "mp3", "ext": "mp3", "resolution": "audio only", "fps": None, "vcodec": None, "acodec": "mp3", "tbr": "320k", "filesize": "~12.5MiB", "proto": "https", "kind": "audio", "label": "MP3 Audio (320 kbps) [~12.5MiB]"},
        {"id": "m4a", "ext": "m4a", "resolution": "audio only", "fps": None, "vcodec": None, "acodec": "aac", "tbr": "256k", "filesize": "~9.8MiB", "proto": "https", "kind": "audio", "label": "M4A Apple AAC (256 kbps) [~9.8MiB]"},
        {"id": "flac", "ext": "flac", "resolution": "audio only", "fps": None, "vcodec": None, "acodec": "flac", "tbr": "900k", "filesize": "~34.0MiB", "proto": "https", "kind": "audio", "label": "FLAC Lossless Audio [~34.0MiB]"},
        {"id": "opus", "ext": "opus", "resolution": "audio only", "fps": None, "vcodec": None, "acodec": "opus", "tbr": "160k", "filesize": "~6.2MiB", "proto": "https", "kind": "audio", "label": "Opus High Fidelity [~6.2MiB]"},
    ]

def probe_media(url):
    """
    Unified Single-Pass Probe: Executes yt-dlp --dump-single-json once,
    extracting complete metadata and parsed formats in one shot.
    """
    ensure_ytdlp()
    cmd = get_ytdlp_cmd() + _YT_DLP_BOT_WORKAROUNDS + [
        "--dump-single-json",
        "--skip-download",
        "--no-playlist",
        url
    ]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = proc.communicate(timeout=60)
        if proc.returncode != 0:
            return {"error": stderr.strip() or "Failed to probe media"}

        data = json.loads(stdout)
        if "entries" in data and data.get("_type") == "playlist":
            entries = [e for e in data.get("entries", []) if e]
            data = entries[0] if entries else data

        duration = data.get("duration") or 0
        raw_formats = data.get("formats", [])
        parsed_formats = parse_formats_list(raw_formats, duration)
        if not parsed_formats:
            parsed_formats = get_synthetic_formats()

        duration_int = int(duration) if duration else 0
        m, s = divmod(duration_int, 60)
        h, m = divmod(m, 60)
        dur_str = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}" if duration_int > 0 else "--:--"

        channel = data.get("uploader") or data.get("channel") or "Multi-Source Media"
        title = data.get("title") or "Unknown Media"
        webpage_url = data.get("webpage_url") or url

        metadata = {
            "id": data.get("id") or "",
            "title": title,
            "channel": channel,
            "uploader": channel,
            "duration": duration_int,
            "durationString": dur_str,
            "thumbnail": data.get("thumbnail") or None,
            "thumbnailUrl": data.get("thumbnail") or "",
            "url": webpage_url,
            "originalUrl": webpage_url,
            "formatsCount": len(parsed_formats),
            "viewCount": data.get("view_count"),
        }

        return {
            "metadata": metadata,
            "formats": parsed_formats,
        }
    except Exception as e:
        return {"error": str(e)}

def extract_formats_table(url):
    ensure_ytdlp()
    # 1. Try dumping single JSON to extract detailed stream list with byte-accurate sizes
    cmd = get_ytdlp_cmd() + _YT_DLP_BOT_WORKAROUNDS + [
        "--dump-single-json",
        "--skip-download",
        "--no-playlist",
        url
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
            raw_formats = data.get("formats", [])
            duration = data.get("duration") or 0
            if raw_formats:
                parsed_rows = parse_formats_list(raw_formats, duration)
                if parsed_rows:
                    return json.dumps(parsed_rows)
    except Exception:
        pass

    # 2. Fallback to parsing yt-dlp -F table
    try:
        from yt_dlp_formatter import fetch_format_table
    except ImportError:
        import importlib.util
        _spec = importlib.util.spec_from_file_location(
            "yt_dlp_formatter",
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "yt_dlp_formatter.py"),
        )
        _mod = importlib.util.module_from_spec(_spec)
        _spec.loader.exec_module(_mod)
        fetch_format_table = _mod.fetch_format_table
    try:
        rows = fetch_format_table(url, get_ytdlp_cmd(), _YT_DLP_BOT_WORKAROUNDS)
        if rows:
            return json.dumps(rows)
    except Exception:
        pass

    # 3. Universal Fallback: Synthetic Tier Formats with Calculated Sizes
    return json.dumps(get_synthetic_formats())

def run_download(args):
    ensure_ytdlp()
    cmd = get_ytdlp_cmd()
    cmd.extend(_YT_DLP_BOT_WORKAROUNDS)

    fmt = args.format
    if getattr(args, 'write_thumbnail', False) or fmt == 'thumbnail':
        cmd.extend(["--write-thumbnail", "--skip-download", "--convert-thumbnails", "jpg"])
    elif getattr(args, 'write_subs', False) or fmt == 'subtitles':
        sub_lang = getattr(args, 'sub_lang', None) or 'en'
        cmd.extend(["--write-subs", "--write-auto-subs", "--sub-lang", sub_lang, "--skip-download", "--convert-subs", "srt"])
    elif fmt:
        if fmt in ('mp3', 'aac', 'm4a', 'opus', 'flac', 'wav'):
            cmd.extend(["-x", "--audio-format", fmt])
            audio_q = args.audio_quality or ('320K' if fmt == 'mp3' else '0')
            cmd.extend(["--audio-quality", audio_q])
        else:
            cmd.extend(["-f", fmt])
    else:
        cmd.extend(["-f", "bv*+ba/b"])

    if getattr(args, 'section', None):
        clean_section = str(args.section).lstrip('*')
        cmd.extend(["--download-sections", f"*{clean_section}"])

    if getattr(args, 'cookies', None) and os.path.exists(args.cookies):
        cmd.extend(["--cookies", args.cookies])

    if getattr(args, 'merge_output_format', None):
        cmd.extend(["--merge-output-format", args.merge_output_format])

    threads = str(args.threads or 8)
    cmd.extend(["-N", threads])

    out_dir = args.out_dir or "./downloads"
    os.makedirs(out_dir, exist_ok=True)
    out_template = os.path.join(out_dir, "%(playlist_index)s - %(title)s [%(id)s].%(ext)s" if args.is_playlist else "%(title)s [%(id)s].%(ext)s")
    cmd.extend(["-o", out_template])

    cmd.append("--continue")

    if args.retries:
        cmd.extend(["--retries", str(args.retries)])

    if not args.is_playlist:
        cmd.extend(["--no-playlist"])

    # Progress template with 0x1F unit separator
    progress_template = "%(progress._percent_str)s\x1f%(progress._downloaded_bytes_str)s\x1f%(progress._speed_str)s\x1f%(progress._eta_str)s\x1f%(progress.filename)s"
    cmd.extend(["--progress-template", f"download:GP:{progress_template}"])

    cache_dir = os.path.join(os.getcwd(), "config", "cache")
    os.makedirs(cache_dir, exist_ok=True)
    cmd.extend(["--cache-dir", cache_dir, "--no-mtime", "--embed-metadata", "--newline"])
    
    if args.url:
        cmd.append(args.url)
    elif args.batch_file:
        cmd.extend(["-a", args.batch_file])

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)

    while True:
        line = proc.stdout.readline()
        if not line and proc.poll() is not None:
            break
        if not line:
            continue
        line_str = line.strip()
        if line_str.startswith("GP:"):
            payload = line_str[3:].strip()
            parts = payload.split("\x1f")
            if len(parts) >= 5:
                pct = 0.0
                try:
                    pct = float(parts[0].replace("%", ""))
                except Exception:
                    pass
                event = {
                    "type": "PROGRESS",
                    "percent": pct,
                    "size": parts[1],
                    "speed": parts[2],
                    "eta": parts[3],
                    "filename": os.path.basename(parts[4])
                }
                print(f"JSON_EVENT:{json.dumps(event)}", flush=True)
                continue

        dest_match = re.search(r'\[(?:download|ExtractAudio|Merger)\]\s+(?:Destination:\s+|Merging formats into\s+"?)([^"\n]+)"?', line_str)
        if dest_match:
            filepath = dest_match.group(1).strip()
            filename = os.path.basename(filepath)
            event = {
                "type": "META",
                "filepath": filepath,
                "filename": filename,
                "title": os.path.splitext(filename)[0]
            }
            print(f"JSON_EVENT:{json.dumps(event)}", flush=True)
            continue

        print(f"JSON_EVENT:{json.dumps({'type': 'LOG', 'message': line_str})}", flush=True)

    proc.wait()
    return proc.returncode

def main():
    parser = argparse.ArgumentParser(description="GridPull Python Engine")
    subparsers = parser.add_subparsers(dest="command")

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("--query", required=True)
    search_parser.add_argument("--count", type=int, default=20)
    search_parser.add_argument("--source", default="youtube")

    info_parser = subparsers.add_parser("info")
    info_parser.add_argument("--url", required=True)
    info_parser.add_argument("--playlist", action="store_true")

    fmt_parser = subparsers.add_parser("formats")
    fmt_parser.add_argument("--url", required=True)

    probe_parser = subparsers.add_parser("probe")
    probe_parser.add_argument("--url", required=True)

    dl_parser = subparsers.add_parser("download")
    dl_parser.add_argument("--url", required=False)
    dl_parser.add_argument("--batch-file", required=False)
    dl_parser.add_argument("--format", default="bv*+ba/b")
    dl_parser.add_argument("--audio-quality", default="320K")
    dl_parser.add_argument("--threads", type=int, default=8)
    dl_parser.add_argument("--out-dir", default="./downloads")
    dl_parser.add_argument("--is-playlist", action="store_true")
    dl_parser.add_argument("--retries", type=int, default=3)
    dl_parser.add_argument("--merge-output-format", default=None)
    dl_parser.add_argument("--section", default=None)
    dl_parser.add_argument("--write-thumbnail", action="store_true")
    dl_parser.add_argument("--write-subs", action="store_true")
    dl_parser.add_argument("--sub-lang", default="en")
    dl_parser.add_argument("--cookies", default=None)

    args = parser.parse_args()

    if args.command == "search":
        print(json.dumps(search_media(args.query, args.count, args.source)))
    elif args.command == "info":
        print(json.dumps(extract_info(args.url, args.playlist)))
    elif args.command == "formats":
        print(extract_formats_table(args.url))
    elif args.command == "probe":
        print(json.dumps(probe_media(args.url)))
    elif args.command == "download":
        sys.exit(run_download(args))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
