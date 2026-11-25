#!/usr/bin/env sh
# Render the app icons from their SVG sources. Needs rsvg-convert (librsvg).
#
#   app/icons/icon.svg    rounded tile: favicon and the "any" manifest icons
#   design/icon-full.svg  full-bleed square: iOS home screen and Android maskable,
#                         where the system rounds the corners itself
#
# The mark is one colour: "p" in Bricolage Grotesque ExtraBold, "/2" in a light
# weight (380). The letters in both SVGs are outlines of that font
# (SIL Open Font License), so rendering needs no font installed.
set -eu
cd "$(dirname "$0")/.."
out=app/icons
rsvg-convert -w 192 -h 192 "$out/icon.svg" -o "$out/icon-192.png"
rsvg-convert -w 512 -h 512 "$out/icon.svg" -o "$out/icon-512.png"
rsvg-convert -w 512 -h 512 design/icon-full.svg -o "$out/icon-maskable-512.png"
rsvg-convert -w 180 -h 180 design/icon-full.svg -o "$out/apple-touch-icon.png"
echo "Icons written to $out/"
