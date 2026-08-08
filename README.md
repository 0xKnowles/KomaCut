# KomaCut 📚

**Convert manga and comics for [KomaOS](https://github.com/0xKnowles/KomaOS) on the XTEink X4.**

<p align="center">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white" alt="Bun" />
    <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat" alt="License" />
</p>

A fork of [xtcjs](https://github.com/varo6/xtcjs) by
[varo6](https://github.com/varo6) & [sodaFMR](https://github.com/sodafmr),
tailored for KomaOS and built to run entirely in the browser with no server
behind it. Everything upstream does — CBZ/CBR, PDF, images, video, merge/split,
metadata — still works; what changed is what ends up in the file's header.

## Which firmware does this target?

KomaCut writes XTC for **[KomaOS](https://github.com/0xKnowles/KomaOS)**, a
manga-focused fork of CrossPoint Reader for the XTEink X4 (ESP32-C3).

Its output is still an ordinary XTC file. Stock firmware and upstream xtcjs read
it exactly as they always did — the additions below live in header bits and a
region those readers never look at. You do **not** need KomaOS to use KomaCut,
but the extra information only means something there.

## What this fork changes

### Split geometry is recorded, not guessed

The container header's qword at `0x28` is not reserved. KomaOS reads it as
packed split geometry, and so does [FlipNzb](https://github.com/0xKnowles/FlipNzb);
upstream xtcjs wrote a zero there.

Without it, a reader rebuilding a full page from strips has to guess two things
it cannot recover from the file: the **overlap**, which follows from the original
page's aspect ratio that conversion consumes, and the **rotation**, which is
baked into the stored pixels with nothing left to say which way it went. Both
guesses are wrong in ways that look like a bad scan — pages upside down, seams
in the wrong place.

KomaCut records both. The overlap is measured off the strips the page was
actually cut with rather than recomputed, because the segment formula floors its
shift and a second derivation can land a pixel out. The rotation is taken from
the **Flip landscape** option instead of being assumed, since this converter
rotates either way.

| bits | field |
|---|---|
| 0–7 | `mode` (index into the mode table; 0 = not recorded) |
| 8–15 | `stripsPerPage` |
| 16–31 | `overlapPerMille` |
| 32–33 | `rotationQuarterTurns` (1 = one clockwise turn) |
| 34 | page-start map present |
| 40–47 | `leadingStrips` |

### A page-start map, for volumes that are not uniform

`leadingStrips` describes front matter only, so it cannot express a **mid-book
double-page spread**. A spread is landscape, so it is never split: it emits one
strip where its neighbours emit three. A reader grouping strips in threes is out
of phase from there to the end of the volume. (KomaOS has a manual *Slice Offset*
setting as a stopgap; a file with this map does not need it.)

KomaCut writes one bit per strip, set where each source page begins. It lives
immediately after the page table, is `ceil(pageCount / 8)` bytes — about 75 for
a 200-page volume — and is announced by bit 34 above.

Bit 34 rather than a version bump is deliberate: KomaOS's parser accepts only
versions 1.0 and 0.1, so a 1.1 file would be **rejected outright** by every
build in the field. A file whose extra bitmap is ignored is strictly better than
one that will not open.

### Overlap strips are cut for the device you picked

`calculateOverlapSegments` hardcoded the X4's 800×480 panel while the rest of the
pipeline honoured the device selector, so every **X3** conversion was cut for the
wrong screen. The X3 is wider, so its strip is about 11% taller: on a 1114×1600
scan the strip should be 742px and was 668px. The strips still rendered,
letterboxed, but every seam sat in the wrong place.

### Removed

The upstream hono server, its Cloudflare/Docker deployment, conversion
telemetry, and the nyaa.si search proxy — all of which need a backend this
build does not have.

## Development

```bash
bun install      # Install dependencies
bun run dev      # Dev server → localhost:5173
bun run test     # Unit tests
bun run build    # Production build → dist/
```

The build is fully static. `BASE_PATH` sets the path the app is served from and
defaults to `/KomaCut/` for GitHub Pages; use `BASE_PATH=/ bun run build` when
serving from a domain root.

## Recommended settings for KomaOS

| Setting | Value |
|---------|-------|
| Device | X4 |
| Split | Overlapping thirds |
| Orientation | Landscape |
| Dithering | Floyd-Steinberg |
| Contrast | Medium |

Read the result in KomaOS's **Full** view: that is the mode that reassembles the
strips into whole pages, and the mode the header fields above exist to serve.

## Credits

Everything here rests on [xtcjs](https://github.com/varo6/xtcjs) by
[varo6](https://github.com/varo6) and [sodaFMR](https://github.com/sodafmr),
which in turn began as a port of [cbz2xtc](https://github.com/tazua/cbz2xtc) by
[tazua](https://github.com/tazua). MIT licensed, as is this fork.
