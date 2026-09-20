"""Live format-table parser for yt-dlp `-F` output.

Extracts format table rows into a structured JSON array.
"""

import json
import re
import sys
import subprocess

_RE_SIZE = re.compile(r'~\s*([\d.]+(?:KiB|MiB|GiB|TiB))|\b([\d.]+(?:KiB|MiB|GiB))')
_RE_TBR  = re.compile(r'(\d+)\s*k\s*$')

def _parse_codec_cell(cell):
    """Return (vcodec, acodec, tbr, kind_label)."""
    cell = cell.strip()
    if 'audio only' in cell:
        parts = cell.split()
        acodec = parts[2] if len(parts) > 2 and not parts[2].endswith('k') else 'unknown'
        tbr = ''
        for p in parts:
            if p.endswith('k') and p[:-1].replace('.', '', 1).isdigit():
                tbr = p
                break
        return None, acodec, tbr, 'audio'
    m = re.match(r'(\S+)\s+(\d+)?k?\s*(video only)?', cell)
    if m:
        vcodec = m.group(1)
        tbr = m.group(2) + 'k' if m.group(2) else ''
        return vcodec, None, tbr, 'video'
    return cell or 'unknown', None, '', 'unknown'

def _parse_resolution_cell(cell, ext):
    """Return (resolution_str, fps)."""
    cell = cell.strip()
    m = re.match(r'(\d+x\d+|audio only|video only)?\s*(\d+)?', cell)
    if not m:
        return 'audio only', None
    res = m.group(1) or 'unknown'
    fps = int(m.group(2)) if m.group(2) and m.group(2).isdigit() else None
    return res, fps

def _parse_filesize_cell(cell):
    """Return a human-readable size string like '119.04MiB' or None."""
    cell = cell.strip()
    m = _RE_SIZE.search(cell)
    if m:
        return m.group(1) or m.group(2)
    return None

def parse_format_table(raw):
    """
    Parse the raw yt-dlp -F text output into a list of dicts.
    """
    if not raw or not isinstance(raw, str):
        return []

    lines = raw.splitlines()
    rows = []
    started = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if not started:
            if stripped.startswith('ID') and 'EXT' in stripped:
                started = True
            continue

        if re.match(r'^-+\s*-+', stripped):
            continue

        if stripped.startswith('[') or stripped.startswith('Available'):
            continue

        normalized_line = line.replace('│', '|').replace('\u2502', '|')
        cols = [c.strip() for c in normalized_line.split('|')]
        if len(cols) < 3:
            continue

        left, mid, right = cols[0], cols[1], cols[2]

        left_tokens = left.split()
        if len(left_tokens) < 2:
            continue
        fmt_id = left_tokens[0]
        ext = left_tokens[1]

        left_rest = left[left.index(ext) + len(ext):].strip() if ext in left else ''
        if 'audio only' in left_rest:
            resolution = 'audio only'
            fps = None
        else:
            m = re.match(r'(\S+)\s+(\d+)?', left_rest)
            resolution = m.group(1) if m else 'unknown'
            fps = int(m.group(2)) if m and m.group(2) and m.group(2).isdigit() else None

        filesize = _parse_filesize_cell(mid)
        mid_tokens = mid.split()
        proto = ''
        tbr = ''
        for tok in mid_tokens:
            if tok in ('http', 'https', 'm3u8', 'mhtml'):
                proto = tok
            elif tok.endswith('k') and tok[:-1].replace('.', '', 1).isdigit():
                tbr = tok

        vcodec, acodec, rtbr, kind = _parse_codec_cell(right)
        if not tbr and rtbr:
            tbr = rtbr

        if 'audio only' in line.lower() and not resolution or resolution == 'audio only':
            kind = 'audio'
        elif vcodec and 'audio' not in str(acodec):
            kind = 'video'
        else:
            kind = 'video' if vcodec else 'audio'

        label_parts = [f'{fmt_id}']
        if ext:
            label_parts.append(ext)
        if resolution and resolution != 'audio only':
            label_parts.append(resolution)
        if fps:
            label_parts.append(f'{fps}fps')
        if vcodec:
            label_parts.append(vcodec)
        if acodec:
            label_parts.append(f'ae:{acodec}')
        if tbr:
            label_parts.append(tbr)
        if filesize:
            label_parts.append(filesize)

        rows.append({
            'id': fmt_id,
            'ext': ext,
            'resolution': resolution,
            'fps': fps,
            'vcodec': vcodec,
            'acodec': acodec,
            'tbr': tbr,
            'filesize': filesize,
            'proto': proto,
            'kind': kind,
            'label': ' '.join(label_parts)
        })

    return rows

def fetch_format_table(url, ytdlp_cmd, bot_workarounds):
    cmd = list(ytdlp_cmd) + list(bot_workarounds) + ['-F', '--no-playlist', url]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    output = proc.stdout if proc.stdout.strip() else proc.stderr
    return parse_format_table(output)
