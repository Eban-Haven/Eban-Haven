# Social Post Performance Export

Place the post-level export for `social-post-strategy-analysis.ipynb` in this folder as:

`social_post_performance.csv`

Recommended columns:

- `platform`
- `content_theme`
- `cta_type`
- `time_bucket`
- `day_of_week`
- `content_type`
- `caption_length`
- `hashtag_count`
- `used_image`
- `revenue_7d_php`
- `donations_7d`

Helpful optional columns:

- `actual_publish_time`
- `tracked_link_id`
- `campaign_tag`
- `post_id`
- `post_url`

The notebook falls back to a tiny embedded demo dataset if this file is missing, but demo-mode output should not be used for operational decisions.
