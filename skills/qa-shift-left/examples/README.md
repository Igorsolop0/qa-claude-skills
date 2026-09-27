# qa-shift-left examples

Calibration samples: what the output should look like and how deep the analysis should go.

| File | Input | What to learn |
| --- | --- | --- |
| [home-page-plan.md](home-page-plan.md) | OpenSpec change `create-home-page` (Client storefront home) | How the Burger layers produce a small scenario set; how the same feature splits between unit, component, OpenSpec mock cases, and a single live smoke; why most scenarios must NOT become live Playwright specs |

Real the platform artifacts the examples map to:

- OpenSpec cases: `openspec/changes/create-home-page/quality-assurance/test-cases/client/home-page.md`
- Live smoke: `qa/tests/Client/FE/smoke/home.spec.ts` (`SMK-HOME-001`, `SMK-HOME-002`)
