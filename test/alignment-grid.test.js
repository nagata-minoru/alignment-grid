const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

/**
 * `index.html` のインラインスクリプトを VM 上に読み込み、DOM と Canvas をスタブした検証環境を返す。
 *
 * @param {object} [options] スタブ環境の設定。
 * @param {number} [options.width=800] キャンバスの表示幅。
 * @param {number} [options.height=600] キャンバスの表示高さ。
 * @param {number} [options.dpr=2] `window.devicePixelRatio` として使う値。
 * @param {number} [options.random=0.5] `Math.random` が返す固定値。
 * @param {number} [options.rectLeft=10] キャンバス矩形の左端座標。
 * @param {number} [options.rectTop=20] キャンバス矩形の上端座標。
 * @returns {object} テストから操作する公開値とスタブの記録状態。
 */
function loadAlignmentGrid({
  width = 800,
  height = 600,
  dpr = 2,
  random = 0.5,
  rectLeft = 10,
  rectTop = 20,
} = {}) {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(scriptMatch, 'index.html にはインラインスクリプトが1つ含まれている必要があります');

  const contextCalls = [];
  const canvasContext = {
    /**
     * 現在の塗り色を返す。
     *
     * @returns {string|undefined} 記録済みの `fillStyle`。
     */
    get fillStyle() {
      return this._fillStyle;
    },
    /**
     * 塗り色をスタブへ記録する。
     *
     * @param {string} value 設定された塗り色。
     */
    set fillStyle(value) {
      this._fillStyle = value;
    },
    /**
     * 現在の線色を返す。
     *
     * @returns {string|undefined} 記録済みの `strokeStyle`。
     */
    get strokeStyle() {
      return this._strokeStyle;
    },
    /**
     * 線色をスタブへ記録する。
     *
     * @param {string} value 設定された線色。
     */
    set strokeStyle(value) {
      this._strokeStyle = value;
    },
    /**
     * 現在の線幅を返す。
     *
     * @returns {number|undefined} 記録済みの `lineWidth`。
     */
    get lineWidth() {
      return this._lineWidth;
    },
    /**
     * 線幅をスタブへ記録する。
     *
     * @param {number} value 設定された線幅。
     */
    set lineWidth(value) {
      this._lineWidth = value;
    },
    /**
     * Canvas の `beginPath` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    beginPath() {},
    /**
     * Canvas の `arc` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    arc() {},
    /**
     * Canvas の `closePath` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    closePath() {},
    /**
     * Canvas の `fill` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    fill() {},
    /**
     * Canvas の `fillRect` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    fillRect() {},
    /**
     * Canvas の `lineTo` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    lineTo() {},
    /**
     * Canvas の `moveTo` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    moveTo() {},
    /**
     * Canvas の `rect` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    rect() {},
    /**
     * Canvas の `restore` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    restore() {},
    /**
     * Canvas の `rotate` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    rotate() {},
    /**
     * Canvas の `save` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    save() {},
    /**
     * Canvas の `setLineDash` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    setLineDash() {},
    /**
     * Canvas の `stroke` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    stroke() {},
    /**
     * Canvas の `translate` 呼び出しを受ける no-op スタブ。
     *
     * @returns {void}
     */
    translate() {},
    /**
     * 変換行列の設定値を検証用に記録する。
     *
     * @param {...number} args `setTransform` に渡された引数。
     * @returns {void}
     */
    setTransform(...args) {
      contextCalls.push({ method: 'setTransform', args });
    },
  };

  const listeners = new Map();
  const classNames = new Set();
  const canvas = {
    clientWidth: width,
    clientHeight: height,
    width: 0,
    height: 0,
    capturedPointerId: null,
    classList: {
      /**
       * CSS クラス名をスタブの集合へ追加する。
       *
       * @param {string} name 追加するクラス名。
       * @returns {void}
       */
      add(name) {
        classNames.add(name);
      },
      /**
       * CSS クラス名をスタブの集合から削除する。
       *
       * @param {string} name 削除するクラス名。
       * @returns {void}
       */
      remove(name) {
        classNames.delete(name);
      },
      /**
       * 指定した CSS クラス名が追加済みかを返す。
       *
       * @param {string} name 確認するクラス名。
       * @returns {boolean} クラス名が存在する場合は `true`。
       */
      contains(name) {
        return classNames.has(name);
      },
    },
    /**
     * キャンバスに登録されたイベントリスナーを種類ごとに保存する。
     *
     * @param {string} type イベント種別。
     * @param {Function} listener 登録するリスナー。
     * @returns {void}
     */
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    /**
     * 保存済みのキャンバスイベントリスナーへイベントを配送する。
     *
     * @param {string} type イベント種別。
     * @param {object} event リスナーへ渡すイベントオブジェクト。
     * @returns {void}
     */
    dispatch(type, event) {
      for (const listener of listeners.get(type) || []) {
        listener(event);
      }
    },
    /**
     * キャンバスの表示矩形を返す。
     *
     * @returns {{left: number, top: number, width: number, height: number}} キャンバスの矩形情報。
     */
    getBoundingClientRect() {
      return {
        left: rectLeft,
        top: rectTop,
        width: this.clientWidth,
        height: this.clientHeight,
      };
    },
    /**
     * 2D 描画コンテキストのスタブを返す。
     *
     * @param {string} type 要求されたコンテキスト種別。
     * @returns {object} CanvasRenderingContext2D 相当のスタブ。
     */
    getContext(type) {
      assert.equal(type, '2d');
      return canvasContext;
    },
    /**
     * キャプチャ対象のポインタ ID を記録する。
     *
     * @param {number} pointerId キャプチャするポインタ ID。
     * @returns {void}
     */
    setPointerCapture(pointerId) {
      this.capturedPointerId = pointerId;
    },
  };

  const windowListeners = new Map();
  const window = {
    devicePixelRatio: dpr,
    /**
     * window に登録されたイベントリスナーを種類ごとに保存する。
     *
     * @param {string} type イベント種別。
     * @param {Function} listener 登録するリスナー。
     * @returns {void}
     */
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
    /**
     * 保存済みの window イベントリスナーへイベントを配送する。
     *
     * @param {string} type イベント種別。
     * @param {object} event リスナーへ渡すイベントオブジェクト。
     * @returns {void}
     */
    dispatch(type, event) {
      for (const listener of windowListeners.get(type) || []) {
        listener(event);
      }
    },
  };

  const deterministicMath = Object.create(Math);
  /**
   * 初期配置を決定的にするため、固定値の乱数を返す。
   *
   * @returns {number} 設定された固定乱数値。
   */
  deterministicMath.random = function randomStub() {
    return random;
  };

  const rafCallbacks = [];
  const context = vm.createContext({
    Math: deterministicMath,
    document: {
      /**
       * テスト対象スクリプトから要求されたキャンバス要素を返す。
       *
       * @param {string} id 要求された要素 ID。
       * @returns {object} キャンバス要素のスタブ。
       */
      getElementById(id) {
        assert.equal(id, 'c');
        return canvas;
      },
    },
    performance: {
      /**
       * アニメーションの初期時刻として固定値を返す。
       *
       * @returns {number} 固定された時刻。
       */
      now() {
        return 0;
      },
    },
    /**
     * `requestAnimationFrame` のコールバックを実行せずに記録する。
     *
     * @param {Function} callback 登録されたフレームコールバック。
     * @returns {number} 登録順に対応する擬似 ID。
     */
    requestAnimationFrame(callback) {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
    window,
  });

  vm.runInContext(
    `${scriptMatch[1]}
globalThis.__alignmentGridTestExports = {
  canvas,
  ctx,
  resize,
  nearestGrid,
  nearestGridInBounds,
  Shape,
  shapes,
  responsiveColumnCount,
  responsiveShapeSize,
  layoutShapes,
  pointerPos,
  loop,
  constants: { GRID, K, C, MASS, SHAPE_COUNT },
  /**
   * VM 内部の現在のドラッグ状態を返す。
   *
   * @returns {{dragShape: object|null, dragDX: number, dragDY: number}} 現在のドラッグ状態。
   */
  getDragState() {
    return { dragShape, dragDX, dragDY };
  }
};`,
    context,
    { filename: htmlPath },
  );

  return {
    ...context.__alignmentGridTestExports,
    contextCalls,
    rafCallbacks,
    window,
  };
}

/**
 * `index.html` にモバイル表示用の viewport 指定があることを検証する。
 *
 * @returns {void}
 */
function testIndexDeclaresViewportMeta() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
}

test('index.html はモバイル向け viewport を宣言する', testIndexDeclaresViewportMeta);

/**
 * VM 由来の座標オブジェクトを Node 側のプレーンオブジェクトへ正規化する。
 *
 * @param {{x: number, y: number}} value 正規化する座標。
 * @returns {{x: number, y: number}} Node 側で比較できる座標オブジェクト。
 */
function gridPoint(value) {
  return { x: value.x, y: value.y };
}

/**
 * `nearestGrid` が座標を最も近い 64px 格子点へ丸めることを検証する。
 *
 * @returns {void}
 */
function testNearestGridRoundsCoordinates() {
  const { nearestGrid } = loadAlignmentGrid();

  assert.deepEqual(gridPoint(nearestGrid(31, 31)), { x: 0, y: 0 });
  assert.deepEqual(gridPoint(nearestGrid(32, 32)), { x: 64, y: 64 });
  assert.deepEqual(gridPoint(nearestGrid(95, 97)), { x: 64, y: 128 });
  assert.deepEqual(gridPoint(nearestGrid(129, 191)), { x: 128, y: 192 });
}

test('nearestGrid は座標を最も近い 64px 格子点へ丸める', testNearestGridRoundsCoordinates);

/**
 * `resize` が DPR を反映したキャンバスの実ピクセルサイズと変換行列を設定することを検証する。
 *
 * @returns {void}
 */
function testResizeScalesCanvasBackingStore() {
  const { canvas, contextCalls, resize, window } = loadAlignmentGrid({
    width: 320,
    height: 240,
    dpr: 2,
  });

  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 480);
  assert.deepEqual(contextCalls.at(-1), {
    method: 'setTransform',
    args: [2, 0, 0, 2, 0, 0],
  });

  canvas.clientWidth = 500;
  canvas.clientHeight = 300;
  window.devicePixelRatio = 1.5;
  resize();

  assert.equal(canvas.width, 750);
  assert.equal(canvas.height, 450);
  assert.deepEqual(contextCalls.at(-1), {
    method: 'setTransform',
    args: [1.5, 0, 0, 1.5, 0, 0],
  });
}

test('resize は DPR に合わせてキャンバスの実ピクセルサイズを調整する', testResizeScalesCanvasBackingStore);

/**
 * `Shape.pick` が図形サイズを半径とする円形の当たり判定を使うことを検証する。
 *
 * @returns {void}
 */
function testShapePickUsesCircularHitArea() {
  const { Shape } = loadAlignmentGrid();
  const shape = new Shape('circle', 100, 100, 20, 0);

  assert.equal(shape.pick(100, 100), true);
  assert.equal(shape.pick(112, 116), true);
  assert.equal(shape.pick(121, 100), false);
}

test('Shape.pick は設定された円形の当たり判定を使う', testShapePickUsesCircularHitArea);

/**
 * `Shape.snap` が最近傍格子点を目標にし、静止状態を解除することを検証する。
 *
 * @returns {void}
 */
function testShapeSnapTargetsNearestGridPoint() {
  const { Shape } = loadAlignmentGrid();
  const shape = new Shape('square', 95, 129, 20, 120);
  shape.settled = true;

  shape.snap();

  assert.equal(shape.tx, 64);
  assert.equal(shape.ty, 128);
  assert.equal(shape.settled, false);
}

test('Shape.snap は最近傍の格子点を目標にしてシミュレーションを再開する', testShapeSnapTargetsNearestGridPoint);

/**
 * `Shape.snap` が画面端に近い図形の目標位置をキャンバス内に収めることを検証する。
 *
 * @returns {void}
 */
function testShapeSnapStaysInsideSmallViewport() {
  const { Shape } = loadAlignmentGrid({
    width: 320,
    height: 568,
  });
  const shape = new Shape('circle', 319, 567, 24, 0);

  shape.snap();

  assert.equal(shape.tx, 296);
  assert.equal(shape.ty, 544);
}

test('Shape.snap は小さい画面でも目標位置をキャンバス内に収める', testShapeSnapStaysInsideSmallViewport);

/**
 * `Shape.step` がドラッグ中の図形に物理更新を適用しないことを検証する。
 *
 * @returns {void}
 */
function testShapeStepSkipsPhysicsWhileDragging() {
  const { Shape } = loadAlignmentGrid();
  const shape = new Shape('diamond', 120, 80, 18, 200);
  shape.tx = 0;
  shape.ty = 0;
  shape.vx = 30;
  shape.vy = -20;
  shape.dragging = true;

  shape.step(1 / 60);

  assert.equal(shape.x, 120);
  assert.equal(shape.y, 80);
  assert.equal(shape.vx, 30);
  assert.equal(shape.vy, -20);
}

test('Shape.step はドラッグ中に物理更新をスキップする', testShapeStepSkipsPhysicsWhileDragging);

/**
 * `Shape.step` がバネ減衰で目標位置に収束し、静止状態へ固定することを検証する。
 *
 * @returns {void}
 */
function testShapeStepDampsMotionUntilSettled() {
  const { Shape } = loadAlignmentGrid();
  const shape = new Shape('hex', 128, 0, 24, 280);
  shape.tx = 0;
  shape.ty = 0;

  for (let i = 0; i < 1200; i++) {
    shape.step(1 / 240);
  }

  assert.equal(shape.x, 0);
  assert.equal(shape.y, 0);
  assert.equal(shape.vx, 0);
  assert.equal(shape.vy, 0);
  assert.equal(shape.settled, true);
}

test('Shape.step は図形が目標位置で静止するまで動きを減衰させる', testShapeStepDampsMotionUntilSettled);

/**
 * ポインタ操作で選択図形が移動し、解放時に格子へスナップすることを検証する。
 *
 * @returns {void}
 */
function testPointerDraggingMovesAndSnapsSelectedShape() {
  const { canvas, nearestGrid, shapes } = loadAlignmentGrid();
  const shape = shapes[0];
  const pointerId = 7;
  const startClientX = shape.x + 10;
  const startClientY = shape.y + 20;

  canvas.dispatch('pointerdown', {
    clientX: startClientX,
    clientY: startClientY,
    pointerId,
  });

  assert.equal(shape.dragging, true);
  assert.equal(shapes.at(-1), shape);
  assert.equal(canvas.classList.contains('dragging'), true);
  assert.equal(canvas.capturedPointerId, pointerId);

  const beforeMove = { x: shape.x, y: shape.y };

  canvas.dispatch('pointermove', {
    clientX: 210,
    clientY: 270,
    pointerId,
  });

  assert.equal(shape.x, 200);
  assert.equal(shape.y, 250);
  assert.equal(shape.vx, (200 - beforeMove.x) * 60);
  assert.equal(shape.vy, (250 - beforeMove.y) * 60);

  canvas.dispatch('pointerup', {
    clientX: 210,
    clientY: 270,
    pointerId,
  });

  const snapped = nearestGrid(200, 250);
  assert.equal(shape.dragging, false);
  assert.equal(shape.tx, snapped.x);
  assert.equal(shape.ty, snapped.y);
  assert.equal(canvas.classList.contains('dragging'), false);
}

test('ポインタドラッグは選択した図形を移動し、解放時に格子へスナップする', testPointerDraggingMovesAndSnapsSelectedShape);

/**
 * 図形が指定したキャンバス範囲内に収まっていることを検証する。
 *
 * @param {object[]} shapes 検証対象の図形配列。
 * @param {number} width キャンバス幅。
 * @param {number} height キャンバス高さ。
 * @returns {void}
 */
function assertShapesFitCanvas(shapes, width, height) {
  for (const shape of shapes) {
    assert.ok(shape.x >= shape.size, `${shape.kind} の x が左にはみ出している`);
    assert.ok(shape.x <= width - shape.size, `${shape.kind} の x が右にはみ出している`);
    assert.ok(shape.y >= shape.size, `${shape.kind} の y が上にはみ出している`);
    assert.ok(shape.y <= height - shape.size, `${shape.kind} の y が下にはみ出している`);
    assert.ok(shape.tx >= shape.size, `${shape.kind} の tx が左にはみ出している`);
    assert.ok(shape.tx <= width - shape.size, `${shape.kind} の tx が右にはみ出している`);
    assert.ok(shape.ty >= shape.size, `${shape.kind} の ty が上にはみ出している`);
    assert.ok(shape.ty <= height - shape.size, `${shape.kind} の ty が下にはみ出している`);
  }
}

/**
 * 初期配置が縦長の小さい画面で複数行に再配置され、全図形が表示範囲に収まることを検証する。
 *
 * @returns {void}
 */
function testResponsiveInitialLayoutFitsNarrowCanvas() {
  const { shapes, responsiveColumnCount, responsiveShapeSize } = loadAlignmentGrid({
    width: 320,
    height: 568,
    random: 0.5,
  });

  assert.equal(responsiveColumnCount(), 2);
  assert.equal(responsiveShapeSize(), 16);
  assert.equal(new Set(shapes.map((shape) => shape.tx)).size, 2);
  assert.equal(new Set(shapes.map((shape) => shape.ty)).size, 4);
  assertShapesFitCanvas(shapes, 320, 568);
}

test('初期配置は狭い画面で複数行に再配置される', testResponsiveInitialLayoutFitsNarrowCanvas);

/**
 * 500px 幅では2列を維持し、狭めのブラウザでも右端が切れないことを検証する。
 *
 * @returns {void}
 */
function testResponsiveLayoutKeepsTwoColumnsAtCompactWidth() {
  const { shapes, responsiveColumnCount } = loadAlignmentGrid({
    width: 500,
    height: 844,
    random: 0.5,
  });

  assert.equal(responsiveColumnCount(), 2);
  assert.equal(new Set(shapes.map((shape) => shape.tx)).size, 2);
  assertShapesFitCanvas(shapes, 500, 844);
}

test('500px 幅では2列配置を維持する', testResponsiveLayoutKeepsTwoColumnsAtCompactWidth);

/**
 * ウィンドウリサイズ時にキャンバスと図形配置が現在の画面サイズへ更新されることを検証する。
 *
 * @returns {void}
 */
function testWindowResizeRelayoutsShapes() {
  const { canvas, shapes, window, responsiveColumnCount } = loadAlignmentGrid({
    width: 800,
    height: 600,
    dpr: 1,
    random: 0.5,
  });

  canvas.clientWidth = 320;
  canvas.clientHeight = 568;
  window.devicePixelRatio = 2;
  window.dispatch('resize', {});

  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 1136);
  assert.equal(responsiveColumnCount(), 2);
  assertShapesFitCanvas(shapes, 320, 568);
}

test('resize は現在の画面サイズへ図形を再配置する', testWindowResizeRelayoutsShapes);

/**
 * アニメーションループが図形を更新し、次フレームを再予約することを検証する。
 *
 * @returns {void}
 */
function testAnimationLoopAdvancesShapesAndSchedulesFrame() {
  const { rafCallbacks, shapes } = loadAlignmentGrid();
  const firstCallback = rafCallbacks.at(-1);
  const shape = shapes[0];
  const before = { x: shape.x, y: shape.y };

  firstCallback(16);

  assert.notDeepEqual({ x: shape.x, y: shape.y }, before);
  assert.equal(rafCallbacks.length, 2);
}

test('アニメーションループは図形を更新し、次フレームを予約する', testAnimationLoopAdvancesShapesAndSchedulesFrame);
