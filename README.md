# Azizbek Juraev — Résumé site

A static, globally hosted résumé with a private admin panel.

| | |
|---|---|
| **Public site** | `/` — anyone can read it. Nobody can change it. |
| **Admin panel** | `/admin/` — sign in with a GitHub token to edit every section. |
| **Content** | `content.json` — the single source of truth for the whole page. |

## How editing works

The site is plain static files, so there is no server to attack and nothing to pay for.
The admin panel writes changes straight back to `content.json` in this repository
through the GitHub API. The host (GitHub Pages / Netlify) redeploys automatically,
usually within a minute.

The access token is stored **only in the admin's browser**. A visitor who opens
`/admin/` without a token sees a login screen and can change nothing.

## Signing in to the admin panel

1. Go to <https://github.com/settings/personal-access-tokens/new>
2. **Repository access** → *Only select repositories* → this repository
3. **Permissions** → *Repository permissions* → **Contents: Read and write**
4. Generate the token and copy it.
5. Open `/admin/`, enter `owner/repo`, the branch, and the token.

If the token ever leaks, revoke it on that same GitHub page — the site itself is unaffected.

## Editing without the panel

`content.json` can also be edited directly on GitHub. The structure mirrors the
sections on the page: `profile`, `contact`, `experience`, `education`,
`certifications`, `skills`, `languages`, `scholarships`, `activities`.

## Local preview

```sh
python3 -m http.server 8899
# open http://127.0.0.1:8899
```
