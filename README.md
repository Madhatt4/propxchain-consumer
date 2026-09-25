# PropXchain consumer app

The web app for [PropXchain](https://propxchain.com), a UK residential
property transaction marketplace, used by sellers, buyers and housebuilders.
Built with Vite, React and Tailwind. It reaches the PropXchain canisters on
the Internet Computer through the
[`@propxchain/core-client`](https://www.npmjs.com/package/@propxchain/core-client)
package.

## About this repository

This repository contains the consumer frontend for PropXchain. The code is
open source under the GNU AGPL v3 licence.

**What you can do with this code:**

- Read, study, and learn from the implementation
- Run it locally for development and evaluation
- Contribute improvements via pull requests
- Fork it under AGPL terms (see [LICENSE](./LICENSE))

**What this code alone does not give you:**

- A working property transaction platform. The backend canisters, regulatory
  integrations and conveyancer panel are commercial and remain proprietary.
- Access to PropXchain's production infrastructure, which requires a
  commercial relationship.
- The ability to process real transactions, which requires the HMLR Business
  Gateway access and regulated panel relationships held by PropXchain Ltd.

PropXchain operates an open-core model: this frontend, including the seller,
buyer and builder portals, is open source; the backend platform and premium
add-ons are commercial products. This structure lets the frontend be openly
auditable and community-improvable, while the regulated infrastructure
operates under the commercial and compliance terms that property
transactions require.

If you want to use PropXchain to transact, visit
[propxchain.com](https://propxchain.com). If you want to build against the
platform's backend, see [the API documentation](https://propxchain.com/api).

## Development

```bash
pnpm install
pnpm dev           # Vite dev server on :3000
pnpm build         # vite build + prerender marketing routes
pnpm test          # vitest
pnpm lint
pnpm type-check
```

Copy `.env.example` to `.env.local` and fill in the values you have. Canister
IDs, the Supabase project and the Cloudflare Worker URLs are read from the
environment at build time. There is no offline mode: flows that need a
canister or a Worker need it configured.

## Deployment

Pushes to `main` that change the app (not docs-only changes) build it once
and upload the same `dist/` to both frontend asset canisters
(`.github/workflows/deploy-frontend.yml`):

- `u4idr-jyaaa-aaaab-qco5q-cai`, the direct ICP URL:
  <https://u4idr-jyaaa-aaaab-qco5q-cai.icp0.io>
- `lzpic-oaaaa-aaaaa-qcwva-cai`, which serves <https://propxchain.com> and
  <https://www.propxchain.com>

## Licence

GNU Affero General Public License v3.0 or later. See [LICENSE](./LICENSE).
`@propxchain/core-client` is licensed separately under Apache-2.0.
