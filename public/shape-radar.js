(() => {
  "use strict";

  const SPIN_SPEED = (2 * Math.PI) / 20;
  const AXIS_MS = 300;
  const GROW_MS = 500;
  const COLLAPSE_MS = 250;
  const BLEND_SECONDS = 0.35;
  const RING_LEVELS = [0.5, 1];
  const RING_SEGMENTS = 48;

  const unit = ([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  };

  // Maximally spread axes: five of the icosahedron's six axes (~63.4 degrees apart) for offense,
  // and the four cube diagonals (~70.5 degrees apart) for defense. Neither set contains the world axes.
  const PHI = (1 + Math.sqrt(5)) / 2;
  const OFFENSE_AXES = [
    [0, 1, PHI], [0, 1, -PHI], [1, PHI, 0], [1, -PHI, 0], [PHI, 0, 1]
  ].map(unit);
  const DEFENSE_AXES = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]].map(unit);
  const negate = v => v.map(value => -value);

  const geometryCache = new Map();
  function geometryFor(count) {
    if (geometryCache.has(count)) return geometryCache.get(count);
    const axes = count > 8 ? OFFENSE_AXES : DEFENSE_AXES;
    const directions = [...axes, ...axes.map(negate)];
    // Brute-force convex hull; the point set is tiny and fixed.
    const triangles = [];
    const total = directions.length;
    for (let a = 0; a < total; a += 1) {
      for (let b = a + 1; b < total; b += 1) {
        for (let c = b + 1; c < total; c += 1) {
          const [p, q, r] = [directions[a], directions[b], directions[c]];
          const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
          const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
          const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          if (Math.hypot(...n) < 1e-9) continue;
          let positive = 0;
          let negative = 0;
          directions.forEach(d => {
            const side = n[0] * (d[0] - p[0]) + n[1] * (d[1] - p[1]) + n[2] * (d[2] - p[2]);
            if (side > 1e-9) positive += 1;
            else if (side < -1e-9) negative += 1;
          });
          if (!positive || !negative) triangles.push([a, b, c]);
        }
      }
    }
    const geometry = { directions, triangles };
    geometryCache.set(count, geometry);
    return geometry;
  }
  const DRAG_RADIANS_PER_PIXEL = 0.012;
  const MAX_FLICK_SPEED = 5;

  // 3x3 row-major matrices.
  const axisRotation = (axis, angle) => {
    const [x, y, z] = axis;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    return [
      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c
    ];
  };

  function multiply(a, b) {
    const out = new Array(9);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        out[row * 3 + column] =
          a[row * 3] * b[column] + a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
      }
    }
    return out;
  }

  function transform(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  }

  // Removes floating-point drift so repeated rotations stay rigid.
  function orthonormalize(m) {
    const normalize = v => {
      const length = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / length, v[1] / length, v[2] / length];
    };
    const r0 = normalize([m[0], m[1], m[2]]);
    let r1 = [m[3], m[4], m[5]];
    const projection = r1[0] * r0[0] + r1[1] * r0[1] + r1[2] * r0[2];
    r1 = normalize([r1[0] - projection * r0[0], r1[1] - projection * r0[1], r1[2] - projection * r0[2]]);
    const r2 = [
      r0[1] * r1[2] - r0[2] * r1[1],
      r0[2] * r1[0] - r0[0] * r1[2],
      r0[0] * r1[1] - r0[1] * r1[0]
    ];
    return [...r0, ...r1, ...r2];
  }

  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

  window.createShapeRadar = function createShapeRadar(canvas) {
    const context = canvas.getContext("2d");
    const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let attributes = [];
    let matrix = multiply(axisRotation([0, 1, 0], 0.5), axisRotation([1, 0, 0], -0.45));
    let omega = [0, 0, 0];
    let spinAxis = { axis: [0, 1, 0], sign: 1 };
    let dragging = false;
    let lastPointer = null;
    let dragVelocity = [0, 0, 0];
    let visible = typeof IntersectionObserver === "undefined";
    let axisMs = 0;
    let growMs = 0;
    let pending = null;
    let paused = false;
    let growth = 0;
    let axisGrowth = 0;
    let frame = 0;
    let lastTime = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let pixelRatio = 1;

    // Candidate spin axes are the shape's own axes (every other attribute direction).
    function shapeAxes() {
      return attributes.length > 8 ? OFFENSE_AXES : DEFENSE_AXES;
    }

    // The object axis closest to vertical becomes the spin axis.
    function chooseSpinAxis() {
      let best = { axis: [0, 1, 0], sign: 1, score: -1 };
      shapeAxes().forEach(axis => {
        const vertical = matrix[3] * axis[0] + matrix[4] * axis[1] + matrix[5] * axis[2];
        if (Math.abs(vertical) > best.score) {
          best = { axis, sign: vertical >= 0 ? 1 : -1, score: Math.abs(vertical) };
        }
      });
      spinAxis = { axis: best.axis, sign: best.sign };
    }

    function spinTarget() {
      if (prefersReducedMotion()) return [0, 0, 0];
      const world = transform(matrix, spinAxis.axis);
      return world.map(value => spinAxis.sign * value * SPIN_SPEED);
    }

    function resize() {
      pixelRatio = window.devicePixelRatio || 1;
      cssWidth = canvas.clientWidth;
      cssHeight = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
      if (visible) draw();
    }

    function draw() {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      const count = attributes.length;
      if (!count || !cssWidth || !cssHeight) return;

      const radius = Math.min(cssWidth, cssHeight) * 0.4;
      const centerX = cssWidth / 2;
      const centerY = cssHeight / 2;
      const focal = radius * 4.5;
      const line = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#394150";
      const project = (x, y, z) => {
        const v = transform(matrix, [x * radius, y * radius, z * radius]);
        const scale = focal / (focal - v[2]);
        return { x: centerX + v[0] * scale, y: centerY - v[1] * scale, z: v[2] };
      };
      const { directions, triangles } = geometryFor(count);

      context.lineJoin = "round";
      context.lineWidth = 1;
      context.strokeStyle = line;
      // Great circles in the three principal planes act as a spherical guide.
      RING_LEVELS.forEach(level => {
        [[0, 1], [0, 2], [1, 2]].forEach(([a, b]) => {
          context.beginPath();
          for (let step = 0; step <= RING_SEGMENTS; step += 1) {
            const angle = (2 * Math.PI * step) / RING_SEGMENTS;
            const p = [0, 0, 0];
            p[a] = Math.cos(angle) * level * axisGrowth;
            p[b] = Math.sin(angle) * level * axisGrowth;
            const point = project(p[0], p[1], p[2]);
            if (step) context.lineTo(point.x, point.y);
            else context.moveTo(point.x, point.y);
          }
          context.globalAlpha = (level === 1 ? 0.5 : 0.28) * axisGrowth;
          context.stroke();
        });
      });

      const origin = project(0, 0, 0);
      const open = axisGrowth;
      attributes.forEach((attribute, index) => {
        const tip = project(...directions[index].map(value => value * open));
        context.strokeStyle = attribute.color;
        context.globalAlpha = 0.5 * open;
        context.beginPath();
        context.moveTo(origin.x, origin.y);
        context.lineTo(tip.x, tip.y);
        context.stroke();
      });

      const ratio = attribute => {
        const rating = Number.isFinite(attribute.rating) ? Math.max(0, Math.min(99, attribute.rating)) : 0;
        return (rating / 99) * growth;
      };
      const front = directions.map(([dx, dy, dz], index) => {
        const scale = ratio(attributes[index]);
        return project(dx * scale, dy * scale, dz * scale);
      });

      // Faces follow the convex hull of the unit directions, scaled by each rating.
      const faces = triangles.map(([a, b, c]) => ({
        points: [front[a], front[b], front[c]],
        color: attributes[a].color,
        alpha: 0.2
      }));
      faces.forEach(face => {
        face.depth = face.points.reduce((sum, point) => sum + point.z, 0) / face.points.length;
      });
      faces.sort((a, b) => a.depth - b.depth);
      faces.forEach(face => {
        context.beginPath();
        face.points.forEach((point, index) => {
          if (index) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
        });
        context.closePath();
        context.fillStyle = face.color;
        context.strokeStyle = face.color;
        context.globalAlpha = face.alpha;
        context.fill();
        context.globalAlpha = 0.45 * Math.min(1, growth * 4);
        context.stroke();
      });

      attributes.forEach((attribute, index) => {
        const tip = project(...directions[index].map(value => value * open));
        context.fillStyle = attribute.color;
        context.globalAlpha = open;
        context.beginPath();
        context.arc(tip.x, tip.y, 3.2, 0, Math.PI * 2);
        context.fill();
        if (Number.isFinite(attribute.rating) && growth > 0) {
          context.globalAlpha = Math.min(1, growth * 4);
          context.beginPath();
          context.arc(front[index].x, front[index].y, 2.4, 0, Math.PI * 2);
          context.fill();
        }
      });
      context.globalAlpha = 1;
    }

    function tick(now) {
      frame = 0;
      if (!visible) return;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
      lastTime = now;

      const reduced = prefersReducedMotion();
      if (pending && (reduced || paused)) {
        attributes = pending;
        pending = null;
        growMs = GROW_MS;
      }
      if (!paused) {
        if (pending) {
          growMs = Math.max(0, growMs - dt * 1000 * (GROW_MS / COLLAPSE_MS));
          if (growMs === 0) {
            attributes = pending;
            pending = null;
          }
        } else {
          axisMs = Math.min(AXIS_MS, axisMs + dt * 1000);
          if (axisMs >= AXIS_MS) growMs = Math.min(GROW_MS, growMs + dt * 1000);
        }
      }
      if (reduced) {
        axisMs = AXIS_MS;
        growMs = GROW_MS;
      }
      const ease = value => value * value * (3 - 2 * value);
      axisGrowth = ease(axisMs / AXIS_MS);
      growth = ease(growMs / GROW_MS);

      if (paused) {
        omega = [0, 0, 0];
        draw();
        return;
      }
      if (!dragging) {
        const target = spinTarget();
        const blend = 1 - Math.exp(-dt / BLEND_SECONDS);
        omega = omega.map((value, index) => value + (target[index] - value) * blend);
        const speed = Math.hypot(omega[0], omega[1], omega[2]);
        if (speed > 1e-5) {
          const step = axisRotation([omega[0] / speed, omega[1] / speed, omega[2] / speed], speed * dt);
          matrix = orthonormalize(multiply(step, matrix));
        }
      }
      draw();
      frame = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (frame || !visible) return;
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }

    function stopLoop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function rotateBy(yaw, pitch) {
      const step = multiply(axisRotation([0, 1, 0], yaw), axisRotation([1, 0, 0], pitch));
      matrix = orthonormalize(multiply(step, matrix));
    }

    canvas.addEventListener("pointerdown", event => {
      dragging = true;
      lastPointer = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      dragVelocity = [0, 0, 0];
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
    });

    canvas.addEventListener("pointermove", event => {
      if (!dragging) return;
      const seconds = Math.max(1, event.timeStamp - lastPointer.time) / 1000;
      const pitch = (event.clientY - lastPointer.y) * DRAG_RADIANS_PER_PIXEL;
      const yaw = (event.clientX - lastPointer.x) * DRAG_RADIANS_PER_PIXEL;
      rotateBy(yaw, pitch);
      dragVelocity = [
        0.6 * (pitch / seconds) + 0.4 * dragVelocity[0],
        0.6 * (yaw / seconds) + 0.4 * dragVelocity[1],
        0
      ];
      lastPointer = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      if (!frame) draw();
    });

    const release = () => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove("is-dragging");
      chooseSpinAxis();
      omega = [clamp(dragVelocity[0], MAX_FLICK_SPEED), clamp(dragVelocity[1], MAX_FLICK_SPEED), 0];
      startLoop();
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);

    canvas.addEventListener("keydown", event => {
      const keys = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] };
      if (!keys[event.key]) return;
      event.preventDefault();
      rotateBy(...keys[event.key]);
      chooseSpinAxis();
      if (!frame) draw();
    });

    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        if (visible) startLoop();
        else stopLoop();
      }).observe(canvas);
    }
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas);

    chooseSpinAxis();
    resize();

    return {
      // A swap keeps the axes open and collapses the old shape before growing the new one;
      // otherwise the whole sequence restarts once the canvas is on screen.
      setData(nextAttributes, { swap = false } = {}) {
        const canSwap = swap && attributes.length && axisMs >= AXIS_MS && !paused;
        if (canSwap) {
          pending = nextAttributes;
        } else {
          attributes = nextAttributes;
          pending = null;
          axisMs = paused ? AXIS_MS : 0;
          growMs = paused ? GROW_MS : 0;
          axisGrowth = growth = paused ? 1 : 0;
          chooseSpinAxis();
        }
        resize();
        startLoop();
      },
      // Freezes spin and the grow-in; dragging still rotates a paused shape.
      setPaused(value) {
        paused = Boolean(value);
        if (!paused) lastTime = 0;
        startLoop();
      }
    };
  };
})();
