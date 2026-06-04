# Kumiki v0.3 ロードマップ

[English](./roadmap-v0.3.md) · 日本語

このドキュメントは v0.3 マイルストーンのスコープ・設計方針・受け入れ基準（AC）を定義する。機能ごとの詳細設計は `spec/` に、動く例は `examples/` に置く、その計画側の対応物である。実装はリポジトリの TDD フローに従う：**設計 → AC → テスト → 実装 → 反復**（[CONTRIBUTING](./CONTRIBUTING.ja.md) 参照）。

## ゴール

v0.2 は spec が「planned for v0.2」と明記した 5 ギャップ（stop-timer / overlay / プラグイン capability / `fix --auto-patch` / `motion`）を埋め、0.2.0 として出荷した。続く 0.2.1（issue #7）の `/code-review` が、コアに残る **健全性（soundness）** の穴を 2 つ表面化させた。いずれも issue 化済みで、いずれも「AI が*正しい*アプリをワンショットで書ける」という AI-first の前提を掘り崩すものだ：

- **#24** — **live** パスで起きた panic（reducer の `panic(...)`、`Ok` への `Result.get-err`、空ケースへの `Option/Result.get`）が、制御された停止ではなく **DOM イベントハンドラ／render を突き抜ける未捕捉例外**として伝播する。reducer-*test* ハーネスは既に panic を捕捉しているのに、live runtime はしていない。
- **#23** — stdlib メソッドショートカット（`recv.method`、括弧なし形式）が **名前のみ・受け手型なし**でディスパッチされるため、メソッドと同名の record/map フィールド（`{head, tail}` に対する `node.head`）が **暗黙に shadow** され、未知の `recv.bogus` も **診断なし**で `undefined` にコンパイルされる。#5・#7 を刺した再発性の「Gotcha 3」。

したがって v0.3 のテーマは **型健全性＆堅牢性**：runtime を*クリーンに*失敗させ、コンパイラに*型を見させて* silent-wrong-value のクラスを止める。新しいエンドユーザ機能はない——これは正しさのマイルストーンである。

2 項目：

| # | 項目 | 出典 | 規模 |
|---|---|---|---|
| 1 | live パスのクリーンな panic ハンドリング（+ `.get` / `.get-err` 整合） | [issue #24](https://github.com/kage1020/Kumiki/issues/24), [stdlib.md §2.2](../spec/stdlib.ja.md), [lifecycle.md §7.3](../spec/lifecycle.ja.md) | S |
| 2 | `FieldAccess` メソッドショートカットの受け手型推論 | [issue #23](https://github.com/kage1020/Kumiki/issues/23), [stdlib.md §2.2.3](../spec/stdlib.ja.md) | L |

## 進行順

独立した PR として、リスクの小さい順に出荷し、各段が green になってから次に進む：

```
M1  クリーンな panic ハンドリング (S, runtime + トップレベル境界 + .get 整合)
M2  受け手型推論                  (L, typecheck コア: 型環境 + inferType)
```

M1 は runtime 内で完結する低リスク項目で、runtime 全体が依拠できる panic モデルを確立する。M2 はより大きく基盤的な変更——type-light なチェッカに初めて本物の型推論パスを入れる——ので最後に置き、v0.2 の M5 同様、**コードの前に ADR から始める**（推論方針を記録する）。

各マイルストーン完了時には標準ゲートを満たすこと：`pnpm exec turbo run typecheck test lint build` が green、新しい例が `check` + `build` + `smoke`（挙動を伴う場合は + scenario）を通る、関連 `spec/*.md` が実装と整合、issue がクローズ、`CHANGELOG` の項目が *Planned* → *Fixed* に移る。

---

## M1 — live パスのクリーンな panic ハンドリング

**設計.** panic は Kumiki の制御された「プログラム停止」シグナルである（[stdlib.md §2.2](../spec/stdlib.ja.md)：`panic(message) : never`「reducer 内のみ」、`Option/Result.get`「None/Err なら panic」、`Result.get-err`「Ok なら panic」）。現状：

- `_stdlib.getErr`（`packages/runtime/src/index.ts`）は `throw` する——意図された panic シグナル——が、`_stdlib.unwrap`（`.get` の lowering）は `None`/`Err` でも **値をそのまま返す**ので、`.get` と `.get-err` は*正反対*に振る舞う（どちらかが spec 違反）。
- **reducer-test** ハーネスは `apply(...)` を try/catch で包み `{panic}` を報告する（`codegen.ts` のテスト emit）——が、**live** の `applyReducer` には try/catch が **無く**、panic が DOM イベントコールバックを未捕捉で突き抜ける：末尾の `render()` が走らず、ディスパッチが途中で中断する。
- tile 単位の `error-boundary = X` による *render* panic は既に処理されている（codegen が tile 本体を try/catch で包み `PanicInfo` フォールバックを描画、`codegen.ts` の ~L1104）。穴は **トップレベル**：`error-boundary` を持たない tile（例：ルート）の下での render panic は依然として突き抜ける。

M1 は live runtime に対して **1 つ**の panic モデルを定義し実装する：

1. **panic シグナル型.** タグ付きの `KumikiPanic` エラーを導入し、制御された panic と任意のバグを区別できるようにする。`panic(msg)`、`Ok` への `Result.get-err`、`None` への `Option.get`、`Err` への `Result.get` がいずれもこれを送出する。（`.get` を `.get-err` と整合：spec どおり**両者とも panic**。）
2. **live reducer ディスパッチ.** `applyReducer` 内の `r.apply(...)` を try/catch で包む。panic 時は **部分的な slot 書き込みを一切行わず**（書き込みは `apply` 返却後にのみ起きるので既にアトミック）、ログ出力し（`console.error`）、runtime の panic 状態を記録し、**以降のディスパッチを停止**する（「プログラム停止」：後続イベントは `disposed` 同様 no-op に、timer はクリア）。イベントハンドラの外へ伝播させない。
3. **トップレベル render 境界.** `render()` 内のルート tile 構築を包み、tile 単位の `error-boundary` で捕捉*されない* render panic がトップレベルの panic ノード（`PanicInfo`：message + location）を描画するようにする（throw しない）。tile 単位の境界が先に捕捉する点は維持。
4. **検証 tier に panic を見せ続ける.** panic はバグであり、クリーンなモデルが tier-2/3 から **隠してはならない**。`smoke()` / `runScenario()` は記録された live panic を失敗として表面化する（従来は throw 例外としてのみ捕捉していた；今後は構造的に捕捉するので、その構造シグナルを smoke へ届ける）。
5. **例の整合.** `.get` の使用を監査する（blog アプリは tile 内も含め `editor.get.title` / `loginError.get.message` を使う）。`.get` の panic 化が render を壊すなら、その例は寛容な挙動に依存していたということで、修正する（`when(... is Some)` で囲う／`.get-or` に切替）——リポジトリの流儀どおり根本修正。

**受け入れ基準.**
- AC1：reducer 内の `panic("msg")` は制御された `KumikiPanic` を送出する；live ディスパッチがそれを捕捉する（未捕捉例外が DOM イベントハンドラの外へ出ない）；runtime テストで検証。
- AC2：panic 後、slot は **ディスパッチ前**の状態を反映し（部分書き込みなし）、後続の reducer ディスパッチは no-op になる（「プログラム停止」）；runtime テストで検証。
- AC3：`Ok` への `Result.get-err`、`None` への `Option.get`、`Err` への `Result.get` が **同一**経路で panic する——`.get` と `.get-err` が [stdlib.md §2.2](../spec/stdlib.ja.md) と整合。
- AC4：どの `error-boundary` tile でも捕捉されない render panic は、throw せずトップレベルの panic フォールバック（message + location）を描画する；既存の tile 単位 `error-boundary` は先に捕捉する（回帰ガード）。
- AC5：`smoke()` / `runScenario()` が live panic を失敗として報告する（クリーンなモデルが検証 tier から panic を隠さない）。
- AC6：新しい例 `examples/features/32-panic-boundary.kumiki`（panic しうる reducer + `error-boundary` フォールバック）が check + build + smoke を通る；scenario が panic 後の状態を表明する。
- AC7：`spec/stdlib.md §2.2`（`.get`/`.get-err` の panic 意味論）を実装と整合させる；`spec/lifecycle.md §7.3` に live error-boundary が実装済みと記す；`spec/errors.md` と `CHANGELOG` を更新；issue #24 をクローズ。

**影響範囲.** `runtime`（`applyReducer` の try/catch、`render()` のトップレベル境界、`_stdlib.unwrap`/`getErr`、panic 状態 + smoke/scenario への表面化）、`compiler`（panic ヘルパやトップレベル境界に codegen 対応が要る場合のみ）、`spec/stdlib.md` + `spec/lifecycle.md` + `spec/errors.md`、`examples/features/`、`tests/`。

---

## M2 — メソッドショートカットディスパッチの受け手型推論

**設計.** 現在のチェッカは **type-light**——名前解決 + a11y + capability で、**型推論なし**（`typecheck.ts` の `checkExpr` の `FieldAccess` ケースは base へ再帰するだけ；ローカル環境は名前→型ではなく名前の `Set<string>`）。そのため `codegen.ts` の `jsOfExpr` の `FieldAccess` ケースは、`(base)[field]` のフィールドフォールスルー **より前**に、`recv.m` の `m` をハードコードされたメソッド一覧と——無条件に——突き合わせてディスパッチする。帰結（issue #23）：

- record `{head, tail}` への `node.head` → `_s.listHead(node)` → `None`（silent wrong value）；`{abs, rel}` への `r.abs` → `NaN`；record への `resp.get-err` → **throw**。
- エスケープハッチがない：括弧形式 `node.head()` も横取りされる（`methodCallJs` + `KNOWN_METHODS`）。
- 診断もない：括弧なし `FieldAccess` 経路は `KNOWN_METHODS` に対して一切検証されないため、未知の `recv.bogus` も暗黙に `undefined` へコンパイルされ、「FieldAccess / methodCallJs / KNOWN_METHODS を同期保持」という不変条件が **非対称**になっている。

M2 はチェッカに **初の型推論パス**を、ディスパッチに必要な範囲ぴったりに絞って追加する：

1. **型環境.** ローカル binds の `Set<string>` を、名前→推論型のマップに置換／拡張する。型の供給源：slot 宣言（型付き）、`fn` 引数（型付き）、tile `in=`（型付き）、`reducer` payload bind、`let` 束縛（RHS から推論）、`match` パターン bind、メソッド引数ラムダ内の `$1`/`$2`、リテラル。
2. **`inferType(expr)`.** 上記の構文に加えメソッド呼び出しの結果型（`list.map(...)` → List、`.parse-int` → Option(Int) など）を扱うベストエフォートの推論器。本当に決められないときは `unknown`/`dynamic` を返す——推論は**語れるところでは健全、語れないところでは沈黙**。
3. **型主導の `FieldAccess` ディスパッチ.** `recv.m` がメソッドショートカットに lowering されるのは、`recv` の推論型が `m` を持つ stdlib 型である **場合のみ**；`recv` がフィールド `m` を持つ record/map なら field access に lowering（shadow しない）。判定が「一覧に名前がある」から「型がメソッドを持つ」へ移る。
4. **診断.** 受け手型が **既知**で、フィールド `m` もメソッド `m` も持たない場合、暗黙の `undefined` ではなく診断（新しい `E01xx undef-field`、または最も近い既存コードの再利用——ADR で決定）を出す。型が **unknown/dynamic** のときは現在の名前ベース挙動にフォールバック（後方互換；文書化）し、既存プログラムが*誤った値*へ回帰しないようにする。
5. **対称な不変条件.** すべての `KNOWN_METHODS` エントリが `FieldAccess` と `methodCallJs` の両 lowering を持つことをビルド時／テスト時チェックで強制し、PR #22 がデータ駆動テストでしか塞いでいなかった構造的穴を閉じる。

**この変更は型チェックの基盤に触れるため、M2 は ADR から始める**（`design-notes/adr-002-receiver-type-inference.md`）：推論の範囲、ディスパッチ規則、unknown 型のフォールバック方針、新エラーコードを記録する——v0.2 M5 が motion レイヤーの前に ADR-001 を要したのと同じ。

**受け入れ基準.**
- AC1：型環境がスコープ内の名前（slot / `fn` 引数 / tile `in` / reducer payload / `let` / `match` bind / `$1`,`$2`）を推論型へ写像する；`inferType` は決められないとき `dynamic` を返す。
- AC2：`recv.m`（括弧なし）がメソッドショートカットにディスパッチされるのは `recv` の推論型がメソッド `m` を持つ **場合のみ**；`m` という名のフィールドはフィールドとして読まれる（shadow しない）——同一ファイル内の `{head, tail}` record と List 受け手に対する codegen テストで検証。
- AC3：**既知**の受け手型に対する未知の `recv.bogus` は、暗黙の `undefined` ではなくコンパイル診断になる。
- AC4：受け手型が `dynamic`/unknown のとき、挙動は現在の名前ベースディスパッチと一致する（既存の引数なし 12 メソッド + 引数ありメソッドが誤った値へ回帰しない）；文書化。
- AC5：「すべての `KNOWN_METHODS` メソッドは `FieldAccess` *と* `methodCallJs` の lowering を持つ」不変条件をテストで強制する（ケース欠落は `(x)["m"]` への暗黙 lowering ではなくビルド失敗にする）。
- AC6：`codegen.ts` の `FieldAccess` ディスパッチが名前のみでなく推論型を消費する。
- AC7：新しい例 `examples/features/33-field-vs-method.kumiki`——メソッドと同名の record フィールドを正しく読む + 同一ファイルで List/Option へのメソッドショートカット——が check + build + smoke（挙動なら + scenario）を通る。
- AC8：`CHANGELOG` の #23 既知の制限ノートを除去；ディスパッチ規則を `spec/stdlib.md §2.2.3` に文書化；新エラーコードを `spec/errors.md` に登録；ADR-002 を執筆；issue #23 をクローズ。

**影響範囲.** `compiler`（`typecheck.ts` の型環境 + `inferType` + 診断；`codegen.ts` の型主導 `FieldAccess` ディスパッチ；新コードのための `ast.ts`/`errors`）、新規 `design-notes/adr-002-*.md`、`spec/stdlib.md` + `spec/errors.md`、`examples/features/`、`tests/`。

---

## バージョン戦略

- `main` は **0.2.1**（v0.2 公開済み；パッケージ別 npm タグあり）。
- v0.3 作業は M1 → M2 を独立フィーチャーブランチで出荷する；包括 `CHANGELOG` エントリは `## [0.3.0]` で、*Planned* リストがマイルストーンごとに *Fixed* へ移る。
- どちらも **issue 化された健全性修正**だが、言語レベルでは依然加算的（M1 は従来未捕捉だった経路を制御下に置く；M2 は silent-wrong-value を診断に変える）——pre-1.0 SemVer の **minor** バンプ。M2 の新診断は従来（暗黙に・誤って）コンパイルできたプログラムを reject しうるが、これは意図的な正しさの厳格化であり CHANGELOG に記す。
- 両マイルストーンが green になったら Changesets で workspace を `0.3.0` にバンプし、リリースパイプライン（repo public、OIDC + provenance——[kumiki-npm-release] 参照）に公開させる。

## v0.3 の非ゴール

- 完全な Hindley-Milner／双方向型システムは入れない。M2 の推論は **最小限・ディスパッチ主導**——field-vs-shortcut の曖昧性解消と未知メンバーの検出にちょうど足りるだけで、汎用の型チェッカではなく、メンバー解決以外の型不一致診断は追加しない。
- 7 レイヤーモデルの変更なし、新しいエンドユーザ構文なし、React 連携／人間ファースト DX なし（[rationale](./rationale.ja.md) から不変）。
- M1 は言語に汎用の例外処理構文を追加しない；panic は唯一の制御された停止シグナルのまま。
