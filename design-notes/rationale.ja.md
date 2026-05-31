# 設計理念

[English](./rationale.md) · 日本語

## 動機

React は人間中心の最適点である。Hooks / Context / JSX は人が読み書きするうえで自然に感じる慣用句であり、20 年近い試行錯誤の到達点でもある。しかしコードを書くのが AI に移っていくにつれ、次のような特性が摩擦になる。

| 摩擦点 | 内容 |
|---|---|
| 構文オーバーヘッド | JSX/TSX は閉じタグ・キャメル属性・式埋め込みでトークンが嵩む |
| 暗黙の副作用 | `useEffect` の依存配列、クロージャの stale capture、cleanup 忘れ |
| 順序依存ルール | Hooks の呼び出し順、条件分岐内禁止、リスト内禁止 |
| 暗黙スコープ | Provider 階層、Context の解決、子孫からの参照 |
| 非局所的レンダリング | 親の再レンダーが子に波及、`memo` で部分的に抑制する複雑性 |

これらは「AI が書く分には書ける」が「**AI が直す・並列で触る**」と急激に難しくなる。バグの原因がプログラム外（実行履歴・依存配列・stale closure）にあると、AI はコンテキスト窓に履歴を全部詰めないと推論できない。

Strand はこの摩擦を構造で消す。

## 設計要件

1. **トークン効率**: 同じ UI を React より少ないトークンで表現できる
2. **副作用の静的追跡可能性**: どの副作用がどの状態に依存し、どこから発火するかが構文から自明
3. **アーキテクチャの予測可能性**: バグ箇所が局所化される、エラーメッセージが機械可読
4. **並列開発耐性**: 数十のエージェントが同時に編集してもセマンティックに壊れない
5. **可読性の放棄を許容**: 人間が読めるかは二次目標。一次目標は AI が正確に書ける・直せる

## 先行研究のレッスン

設計に至るまでに参照した試みと、そこから取り入れた / 避けた要素：

| 試み | 取り入れた | 避けた |
|---|---|---|
| Elm | 完全な副作用分離、Result/Option 型 | ボイラープレートの膨張、ローカル状態禁止の硬直さ |
| Unison | content-addressable な定義、ハッシュベース参照 | テキスト/Git エコシステムからの完全分断 |
| Eve / Differential Dataflow | データフローとしての UI、宣言的クエリ | 高頻度更新ツリーでの IVM 計算爆発 |
| Hazel / Subtext | typed holes、構文エラーゼロ | 入力摩擦による開発体験の悪化 |
| Dark | trace 駆動のデプロイ、UI と実行の融合 | エコシステムロックイン |
| SolidJS | fine-grained reactivity、コンパイル時依存解析 | シグナルの stale 問題、隠れた追跡範囲 |
| Qwik | resumability、SSR 後の O(1) 起動 | 学習コストとデバッグの複雑さ |
| Hyperscript | DOM 局所性、コンテキストスイッチゼロ | 大規模化での密結合スパゲティ |
| Datomic | append-only fact log、時間旅行クエリ | 高頻度更新には向かない |

## 4 つの独立案が収束した先

設計は、互いを参照しない 4 つの独立案（それぞれ別のモデル支援による探索）から始まった：

| 案 | 一言 |
|---|---|
| **IR + Actor + Effect descriptor** | S 式 IR、Elm Architecture、capability 付き effect、compile-to-DOM |
| **Loom: Episode-oriented Runtime** | Episode / Intent / Capability / Projection / Trace |
| **Pyramid: Effect-Typed Tile Language** | TSV 1 行 1 宣言、5 層分離、グローバル slot |
| **Nexus: CRDT-Native Triple-Graph** | グラフ DB、Triple op、Reactive Datalog |

4 案を批判的に比較すると、はっきりしたことが一つある。**表面の構文は違っても、すべてが同じ 4 点に収束していた。**

### 収束した 4 つの核

1. **副作用は明示 descriptor**（関数呼び出しではない）
2. **ローカル状態の禁止 / 最小化**（全状態が静的に位置特定可能）
3. **source ≠ runtime**（IR とコンパイルを必須化）
4. **append-only causal log**（debug/replay/audit を一つの基盤に統合）

残った論点は **ソース表現の物理形式だけ** だった。

## Strand のポジション

Strand は 4 案のハイブリッドである。各案の強い部分を取り、弱い部分を別の案で補う。

| 採用 | 出所 |
|---|---|
| 7 レイヤ強制分離（type / slot / effect / reducer / tile / fn / app） | Pyramid + Strand 拡張 |
| capability 付き effect descriptor | IR+Actor / Pyramid |
| episode log + replay | Loom |
| content-addressable な定義ストア | IR+Actor / Nexus |
| 名前付き slot（opaque ID ではなく可読名） | Pyramid |
| CRDT op による並列編集 | Nexus |
| 局所ネスト許容（tile 内のみ S 式風） | IR+Actor |
| グラフコンパイラ（参照整合性を静的検査） | Nexus |
| `--ai-fix` モード（エラー→自動修復ループ） | Strand 新規 |

### 各案の弱点を Strand がどう避けるか

| 弱点 | 由来 | Strand での回避 |
|---|---|---|
| S 式の括弧地獄 | IR+Actor | tile 内のみネスト許容、それ以外は 1 行 1 宣言 |
| Effect type 伝搬地獄 | IR+Actor | effect は descriptor、伝搬は capability 集合のみ |
| Projection の IVM 計算爆発 | Loom | signal graph による局所更新（projection を全体再構築しない） |
| trace スキーマ進化非互換 | Loom | content-hash と episode の versioning で過去 trace は immutable |
| TSV の表現力限界 | Pyramid | tile 内ネスト許容、reducer の `do=` は複数文 |
| アセンブリ退化 | Pyramid | 名前付き slot + コンパイラが命名強制 |
| CRDT の意味的衝突 | Nexus | コンパイラが ref-integrity を CRDT op レベルで検査 |
| opaque ID の長距離参照 | Nexus | 表面は名前、内部は hash、参照は CLI が解決 |
| Reactive Datalog の計算コスト | Nexus | Datalog ではなく compiled signal graph |

## 用語

| 用語 | 意味 |
|---|---|
| **definition** | type / slot / effect / reducer / tile / fn / app のいずれか 1 件 |
| **layer** | 7 種の定義カテゴリ |
| **fn** | 補助の純粋関数（slot 読み書き禁止、effect emit 禁止） |
| **content-hash** | 定義の本体と推移依存をハッシュした 256bit 識別子 |
| **slot** | 名前付きグローバル状態 |
| **effect** | 副作用を表す純粋なレコード値（実行ではない） |
| **emit** | reducer から effect 値を放出する操作 |
| **reducer** | event → state 変更 + effect emit の純粋関数 |
| **tile** | slot から DOM 投影への純粋関数 |
| **episode** | 1 つのトリガから派生した因果列（reducer 実行・effect 実行・状態変化の集合） |
| **capability** | アプリ起動時に宣言する副作用許可の集合 |
| **CRDT op** | AI エージェントが definition store に対して行う編集操作 |

## 非目標

Strand は次のものを目指さない。

- **既存 React コードの段階移行**: 互換性ゼロでよい。新規アプリ専用
- **人間によるフルスクラッチ開発**: 人間も書けるが快適ではない
- **任意の DSL/言語拡張**: マクロ・プラグインを許さない（AI の学習対象を 1 つに保つため）
- **動的型・実行時型生成**: すべて静的
- **複数のレンダリングターゲット**: DOM のみ（Native / Canvas は別言語）

## 次に読む

- 言語の全体像 → [Language Core](../spec/language.md)
- すぐ例を見たい → [examples/apps/01-counter/app.strand](https://github.com/kage1020/Strand/blob/main/examples/apps/01-counter/app.strand)
