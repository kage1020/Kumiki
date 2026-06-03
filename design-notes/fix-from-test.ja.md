# `kumiki fix --auto-patch <test-name>` (v0.2 M4b)

[English](./fix-from-test.md) · 日本語

[spec/testing.ja.md](../spec/testing.ja.md) §8.7.1 は、失敗したテストから**修正パッチを提案する**モード `kumiki fix --auto-patch <test-name>` を約束していた。M4a で [`test` レイヤー + ランナー](./test-runner.ja.md) を出荷し、M4b でその約束を実体化する。本ノートはスコープ判断 — すなわち *どの* テスト失敗を決定論的に修復でき、残りをなぜ推測せず報告に留めるか — を記録する。

## 健全性の制約

**失敗する** `test` 定義は次の 2 形態のいずれかで、決定論的に修復できるのは一部だけ：

- **コンパイルできない。** `.kumiki`（テスト込み）に型エラーがあり、テストが走らない。これは既存 `planFixes` の領域（`E0102`–`E0105` の名前タイポ、`E0001` の `/404` 欠落）。
- **コンパイルは通るが結果が `expect` と乖離する。** reducer/tile は型整合だが別の値を生む。*一般にこれは決定不能* — テストが `+1` を期待したのに `count - 1` をした reducer に、回復可能な「意図した演算子」は存在しない。ここで推測するのは報告より悪い。

ゆえに `fix --auto-patch` は**証明できるものだけ**を修復し、残りは diff を報告する（spec AC1 が明示的に「明確な *no auto-patch available* と diff」を許容している）。

## 2 つの Tier

**Tier 1 — コンパイル阻害（`planFixes` 再利用）。** ファイルがコンパイル不能なら名前付きテストは走れない。阻害している型エラーを既存 `planFixes` 経路で修復し、（apply モードで）テストを再実行する。spec AC3。

**Tier 2 — 振る舞い、決定論的リテラル修復。** ファイルがコンパイルでき、かつ名前付きテストが**失敗**したら、失敗した**リーフ**（ランナーが既に算出する乖離点のスカラー）を見る。リーフが**文字列**で、その *実際値* がソース中に**逐語的かつ一意に**文字列リテラルとして出現するとき、修正は一意に定まる — そのリテラルを *期待値* に置換する。これはまさに spec §8.7.1 のスナップショット事例（`heading("Count: 5")` vs `heading("Count: 0")` — 描画テキストはソースのリテラル由来）。一意性が決定論性を担保する：実際の文字列が逐語的リテラルでなければ（例：連結で組み立てられた）見つからず、複数回出現すれば対象が曖昧 — どちらも「no auto-patch」へ落ちる。

この単一ルールが両種を覆う：
- **tile-test** — `.text` リーフ差分で実際テキストが一意のソースリテラル（典型的なスナップショット修復、spec AC2）。
- **reducer-test** — `slots.X` リーフ差分で当該 slot が一意リテラルから代入された**文字列**。

数値・構造的乖離（slot 数、effect リスト、演算子ミス）はリテラル修復**不可**で、報告される。

## 副産物：値矢印

リテラルを特定するため、runtime はスカラーのリーフ値（`TestResult.leaf = { expected, actual }`）を、既存の整形済み全ツリー `expected`/`actual` + `diffAt` パスと並べて保持するようになった。これにより `kumiki test` が spec §8.7.1 の値矢印を出力できる：

```
FAIL  counter-display
  expected: column(heading("Count: 5"), row(...))
  actual:   column(heading("Count: 0"), row(...))
  diff at:  heading[0].text  "Count: 5" -> "Count: 0"
```

ゆえに M4b は [spec/testing.ja.md](../spec/testing.ja.md) §8.1 から「リーフ単位の値矢印 … 未出力」の留保も外す。（テスト毎の所要時間と property-test のケース数は未実装のまま。）

## CLI 表面

`--apply` を単一の変更ゲートに据える（既存 `kumiki fix` と整合）：

```bash
kumiki fix <file> --auto-patch <test-name>           # dry-run：提案のみ、書き込まない（AC4）
kumiki fix <file> --auto-patch <test-name> --apply   # 適用 → テスト再実行（AC5）
```

dry-run は提案パッチを表示。apply は書き込み、**全**テストを再実行し、名前付きテストが通るようになったか・他テストが退行したかを報告する。（spec は模式的に `kumiki fix --auto-patch <test-name>` とファイル引数を省くが、CLI は常に先頭位置引数でファイルを取る。）

## 受け入れ基準（M4b）

- AC1: `kumiki fix <file> --auto-patch <name>` が名前付きテストを解決・実行し、失敗時に 1 つ以上の候補パッチ、または diff 付きの明確な「no auto-patch available」を出す。
- AC2: 実際テキストが一意のソースリテラルである tile-test スナップショット不一致は、当該リテラルへのパッチを生み、適用でテストが通る。
- AC3: ファイルがコンパイル不能なら、`fix` は `planFixes` を再利用して阻害エラーを修復しテストを走らせる。
- AC4: `--apply` なしでは提案パッチを表示しファイルを変更しない。
- AC5: `--apply` ありではパッチ後に名前付きテストを再実行し、通るようになったか・他テストが退行したかを出力する。
- AC6: 回帰テストが全ループを覆う：失敗テスト → 提案 → 適用 → 成功（コンパイル阻害ケースと振る舞いケース）。
- AC7: `spec/testing.md` §8.7.1 の「planned for v0.2」文を出荷挙動に差し替え、§8.1 status note から値矢印の留保を外す。

## 繰り延べ（後続、ここで追跡）

- **一意文字列リテラルを超える振る舞い修復** — 連結・補間テキスト（動的部分に対しリテラル片を整列）、数値 slot ミス、誤った演算子、effect リスト不一致。これらは正しさを保証できない意図推論や整列ヒューリスティックを要し、今は diff 報告する。
- **複数パッチ探索** — 複数の候補編集を試しテストが緑になるものを残す（決定論的単発パッチの上の探索ループ）。
- **scenario/smoke 駆動の修正** — `kumiki run` トレースや `smoke` 失敗をパッチ源にする（M4b は `test` 結果のみを消費）。

これらは加算的で、各々後から example + test 付きで追加できる（リポジトリの「example と test で答える」方針と整合）。
