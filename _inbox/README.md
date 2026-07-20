# Media inbox

Dump photos and video files here (any names, straight off the phone), then run:

    npm run inbox

The script asks where each file belongs, resizes anything oversized, moves it
into the right entry/log folder, and writes the frontmatter (cover / gallery
with alt text / log image / video) for you. Files left in this folder are
gitignored — nothing ships until it's been sorted.

Tip: iPhone HEIC files aren't supported — export as JPG first.
