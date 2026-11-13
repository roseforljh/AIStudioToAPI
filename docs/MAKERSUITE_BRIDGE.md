# MakerSuite generation bridge

The browser host intercepts the AI Studio Build proxy generation RPC and uses the MakerSuite GenerateContent bridge. The bridge is adapted with permission from yunx738/ais2api (CC BY-NC 4.0) through Naoya666/AIStudioToAPI, commit 9de526a4f7ec86bc6c09dc080cf43b4ebdfea1a2. Attribution and licensing notices in the source must be retained.

Set `AI_STUDIO_APP_URL` in the deployment environment to use your own shared Build App. Do not commit credentials, auth files, proxy URLs or private configuration. The bridge buffers generated responses, including streaming RPCs; true incremental generation is not guaranteed. Initial validation covers basic non-streaming text only. Image, tools, concurrency, long responses and account-specific access require separate verification. The transport depends on an undocumented Google interface and may stop working after upstream changes.

For the in-process schema encoder, observed field mappings, regression checks, and compatibility limits, see [MakerSuite schema 编码与源码集成](zh/makersuite-schema-encoding.md). Encoding tests do not establish upstream model support or end-to-end client compatibility.

All four API formats share the same upstream field projection. Unmapped options are ignored rather than rejected; tool argument/result payloads are preserved. Ignored constraints and hosted-tool options are not guaranteed to execute. See the schema notes for the tested scope.
