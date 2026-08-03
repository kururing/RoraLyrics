# Rora Audio Quality manual verification

- [ ] Album, playlist, artist top tracks, search, and mix tables show `QUALITY` immediately before `TIME`.
- [ ] Header and row cells align without covering title, duration, Add, Favorite, context menu, or row interactions.
- [ ] Catalog-only rows show honest labels (`MAX`, `LOSSLESS`, `HIGH`, `LOW`, `ATMOS`) rather than invented bit depth/sample rate.
- [ ] Now Playing shows bit depth/sample rate/codec only when present in current playback context.
- [ ] Full, Compact, Catalog-only, unknown Dash/Hide, codec, tooltip, and both enable switches update immediately.
- [ ] Widths above 1100px, 760–1100px, and below 760px do not introduce horizontal overflow.
- [ ] Switching tracks never carries Track A quality into Track B.
- [ ] Reloading the plugin does not duplicate headers, cells, badges, observers, or subscriptions.
- [ ] Disabling/unloading restores the original track table and player-bar layout.
- [ ] Startup, navigation, and metadata loading never play, pause, seek, alter queue, or change audio settings.
- [ ] Album/playlist with 50–100 tracks remains responsive; requests never exceed concurrency 4.
- [ ] Dark/custom themes and Exclusive Mode continue to work without audio pipeline changes.
