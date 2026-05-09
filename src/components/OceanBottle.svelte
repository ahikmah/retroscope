<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import * as THREE from 'three'

  const dispatch = createEventDispatcher()
  export let state = 'idle'

  let canvas
  let renderer, scene, camera, clock
  let waterMesh, waterUniforms
  let bottleGroup
  let animId, ro
  let launchT = 0
  let prevState = 'idle'
  let camDriftT = 0

  $: if (state === 'launching' && prevState !== 'launching') {
    launchT = 0
    prevState = 'launching'
  }

  // JS wave height mirror for bottle positioning
  // PlaneGeometry in local XY → local X = world X, local Y = world -Z
  function waveH(wx, wz, t) {
    // world X = local X, world Z = -local Y  →  local Y = -wz
    const lx = wx, ly = -wz
    const waves = [
      [[1.0,  0.4], 1.8, 0.038, 0.75, 0.0],
      [[0.4,  1.0], 1.2, 0.058, 0.65, 2.1],
      [[-0.7, 0.6], 0.8, 0.095, 0.90, 4.7],
      [[0.8, -0.5], 0.4, 0.152, 1.15, 1.4],
      [[-0.4,-0.8], 0.2, 0.245, 1.45, 3.8],
    ]
    let h = 0
    for (const [[dx,dy], amp, freq, speed, phase] of waves) {
      const len = Math.sqrt(dx*dx + dy*dy)
      h += amp * Math.sin(freq * (dx/len*lx + dy/len*ly) - speed*t + phase)
    }
    return h
  }

  // ── Vertex shader ─────────────────────────────────────────────────────────────
  // PlaneGeometry lies in local XY (z=0). After rotation.x=-PI/2:
  //   local X → world X, local Y → world -Z, local Z → world Y (up)
  // So we displace local Z for height, use local XY for wave spreading.
  // World normal: local (-dhx, -dhy, 1) → after -PI/2 around X → (-dhx, 1, dhy)
  const vertexShader = `
    uniform float uTime;
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying float vHeight;

    void addWave(vec2 xy, vec2 dir, float amp, float freq, float speed, float phase,
                 inout float h, inout float dhx, inout float dhy) {
      vec2  d = normalize(dir);
      float f = freq * dot(d, xy) - speed * uTime + phase;
      h    += amp * sin(f);
      float c = amp * freq * cos(f);
      dhx  += c * d.x;
      dhy  += c * d.y;
    }

    void main() {
      vec2  xy = position.xy;
      float h  = 0.0, dhx = 0.0, dhy = 0.0;

      addWave(xy, vec2( 1.0,  0.4), 1.8, 0.038, 0.75, 0.0, h, dhx, dhy);
      addWave(xy, vec2( 0.4,  1.0), 1.2, 0.058, 0.65, 2.1, h, dhx, dhy);
      addWave(xy, vec2(-0.7,  0.6), 0.8, 0.095, 0.90, 4.7, h, dhx, dhy);
      addWave(xy, vec2( 0.8, -0.5), 0.4, 0.152, 1.15, 1.4, h, dhx, dhy);
      addWave(xy, vec2(-0.4, -0.8), 0.2, 0.245, 1.45, 3.8, h, dhx, dhy);

      vec3 pos = position;
      pos.z   += h;   // local Z displacement → world Y (up)

      // World-space normal after -PI/2 X rotation: (-dhx, 1, dhy)
      vNormal   = normalize(vec3(-dhx, 1.0, dhy));
      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      vHeight   = h;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `

  // ── Fragment shader ───────────────────────────────────────────────────────────
  const fragmentShader = `
    uniform float uTime;
    uniform vec3  uCamPos;
    uniform vec3  uMoonDir;
    uniform vec3  uHorizonCol;
    varying vec3  vWorldPos;
    varying vec3  vNormal;
    varying float vHeight;

    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i),           hash21(i+vec2(1,0)), f.x),
                 mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec2 p = vWorldPos.xz;

      // ── Micro-ripple normals ─────────────────────────────────────────────────
      // Moon is directly ahead → flat water already nearly-perfectly reflects it.
      // Noise tilts normals randomly → some facets reflect moon (sparkle), rest miss.
      float e  = 0.8;
      vec2 uv1 = p * 0.12 + vec2(uTime * 0.14, uTime * 0.09);
      float d1x = (vnoise(uv1+vec2(e,0)) - vnoise(uv1-vec2(e,0))) / (2.0*e) * 0.18;
      float d1z = (vnoise(uv1+vec2(0,e)) - vnoise(uv1-vec2(0,e))) / (2.0*e) * 0.18;
      vec2 uv2  = p * 0.38 - vec2(uTime * 0.22, uTime * 0.16);
      float d2x = (vnoise(uv2+vec2(e,0)) - vnoise(uv2-vec2(e,0))) / (2.0*e) * 0.08;
      float d2z = (vnoise(uv2+vec2(0,e)) - vnoise(uv2-vec2(0,e))) / (2.0*e) * 0.08;
      N = normalize(N + vec3(-(d1x+d2x), 0.0, -(d1z+d2z)));

      // ── View & Fresnel ───────────────────────────────────────────────────────
      vec3  V       = normalize(uCamPos - vWorldPos);
      float NdotV   = max(dot(N, V), 0.0);
      float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);

      // ── Water colour ─────────────────────────────────────────────────────────
      float ht = clamp(vHeight * 0.28 + 0.45, 0.0, 1.0);
      vec3 waterCol = mix(
        mix(vec3(0.012, 0.032, 0.105), vec3(0.022, 0.062, 0.185), smoothstep(0.0, 0.5, ht)),
        vec3(0.036, 0.100, 0.290), smoothstep(0.5, 1.0, ht)
      );
      vec3 skyRefl = vec3(0.042, 0.068, 0.200);
      vec3 color   = mix(waterCol, skyRefl, fresnel * 0.60);

      // ── Gentle moon face lighting ────────────────────────────────────────────
      float diff = max(dot(N, uMoonDir), 0.0);
      color += vec3(0.07, 0.11, 0.24) * diff * 0.28;

      // ── Moon reflection via environment-map ray test ─────────────────────────
      // Reflect view ray through perturbed normal, check if it hits moon disc.
      // NO Blinn-Phong — only real geometric intersection → no blobs possible.
      vec3 R = reflect(-V, N);    // reflected ray direction (outgoing from surface)
      vec3 moonCenter = vec3(0.0, 22.0, -500.0);
      vec3 toMoon = moonCenter - vWorldPos;
      float tHit  = dot(toMoon, R);                    // distance along R to closest approach
      float dSq   = dot(toMoon,toMoon) - tHit * tHit;  // squared miss distance
      float mRad  = 26.0;
      // Only count reflections going toward moon (tHit > 0) and within disc radius
      float hit   = step(0.0, tHit) * step(dSq, mRad * mRad);
      float edge  = hit * (1.0 - sqrt(max(dSq, 0.0)) / mRad); // brighter at center
      color += vec3(1.00, 0.97, 0.88) * edge * 3.2;

      // ── Foam at wave crests ──────────────────────────────────────────────────
      float foam = smoothstep(1.2, 2.0, vHeight);
      color = mix(color, vec3(0.58, 0.76, 0.94), foam * 0.24);

      // ── Horizon fog ──────────────────────────────────────────────────────────
      float dist = length(p - uCamPos.xz);
      color = mix(color, uHorizonCol, (1.0 - exp(-dist * 0.0050)) * 0.70);

      gl_FragColor = vec4(color, 1.0);
    }
  `

  onMount(() => {
    requestAnimationFrame(() => { init(); loop() })
    ro = new ResizeObserver(onResize)
    ro.observe(canvas)
  })

  onDestroy(() => {
    cancelAnimationFrame(animId)
    ro?.disconnect()
    renderer?.dispose()
  })

  function init() {
    const w = canvas.clientWidth  || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.setClearColor(0x050a18)
    renderer.toneMapping    = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.5

    scene = new THREE.Scene()
    const horizonCol = new THREE.Color(0x08102a)
    scene.fog = new THREE.FogExp2(0x08102a, 0.003)

    // Camera — slightly elevated, looking toward horizon
    camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1200)
    camera.position.set(0, 3, 9)
    camera.lookAt(0, 0, -4)

    clock = new THREE.Clock()

    // Lights (for bottle geometry)
    scene.add(new THREE.AmbientLight(0x1a2e55, 6))
    const moonLight = new THREE.DirectionalLight(0xc8dcf8, 4.5)
    moonLight.position.set(0, 22, -500)
    scene.add(moonLight)
    const fillLight = new THREE.DirectionalLight(0x1a3570, 1.0)
    fillLight.position.set(-30, 20, 30)
    scene.add(fillLight)

    // ── Sky ───────────────────────────────────────────────────────────────────
    const skyGeo = new THREE.SphereGeometry(600, 32, 16)
    scene.add(new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float t = clamp(vPos.y / 280.0, 0.0, 1.0);
          vec3 horizon = vec3(0.032, 0.052, 0.160);
          vec3 zenith  = vec3(0.003, 0.006, 0.030);
          gl_FragColor = vec4(mix(horizon, zenith, pow(t, 0.55)), 1.0);
        }
      `,
    })))

    // ── Stars ─────────────────────────────────────────────────────────────────
    const starPos = []
    for (let i = 0; i < 2400; i++) {
      const r = 400 + Math.random() * 120
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.random() * Math.PI * 0.48
      starPos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      )
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.85
    })))

    // ── Moon disc ─────────────────────────────────────────────────────────────
    // Moon directly in front of camera, just above horizon
    // Same azimuth as camera forward → flat water naturally reflects it
    const moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff8d0, side: THREE.DoubleSide })
    )
    moonMesh.position.set(0, 22, -500)
    moonMesh.lookAt(camera.position)
    scene.add(moonMesh)
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(55, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.05, side: THREE.DoubleSide })
    )
    halo.position.copy(moonMesh.position)
    halo.lookAt(camera.position)
    scene.add(halo)

    // ── Ocean ─────────────────────────────────────────────────────────────────
    waterUniforms = {
      uTime:       { value: 0 },
      uCamPos:     { value: new THREE.Vector3(0, 3, 9) },
      uMoonDir:    { value: new THREE.Vector3(0, 22, -500).normalize() },
      uHorizonCol: { value: horizonCol },
    }
    waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800, 180, 180),
      new THREE.ShaderMaterial({
        uniforms:   waterUniforms,
        vertexShader,
        fragmentShader,
        extensions: { derivatives: true },
      })
    )
    waterMesh.rotation.x = -Math.PI / 2
    scene.add(waterMesh)

    // ── Bottle ────────────────────────────────────────────────────────────────
    bottleGroup = buildBottle()
    bottleGroup.position.set(0.5, 0, 1.5)
    bottleGroup.scale.setScalar(1.8)
    scene.add(bottleGroup)
  }

  function buildBottle() {
    const g = new THREE.Group()
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x2a6050, metalness: 0, roughness: 0.06,
      transmission: 0.58, thickness: 0.6,
      transparent: true, opacity: 0.82,
      ior: 1.45, reflectivity: 0.9, envMapIntensity: 1.4,
    })
    const cork  = new THREE.MeshStandardMaterial({ color: 0x7a5c2e, roughness: 0.8 })
    const paper = new THREE.MeshStandardMaterial({ color: 0xf0e2bc, roughness: 0.95 })
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m) }
    add(new THREE.CylinderGeometry(0.14, 0.15, 0.02, 28), glass, -0.27)
    add(new THREE.CylinderGeometry(0.13, 0.14, 0.52, 28), glass,  0.00)
    add(new THREE.CylinderGeometry(0.065, 0.13, 0.16, 28), glass, 0.34)
    add(new THREE.CylinderGeometry(0.052, 0.065, 0.20, 28), glass, 0.50)
    add(new THREE.CylinderGeometry(0.064, 0.055, 0.04, 28), glass, 0.61)
    add(new THREE.CylinderGeometry(0.054, 0.054, 0.07, 20), cork,  0.655)
    add(new THREE.CylinderGeometry(0.072, 0.072, 0.34, 12), paper, -0.03)
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),
      new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent:true, opacity:0.55 }))
    glow.position.y = -0.03; g.add(glow)
    const pl = new THREE.PointLight(0xffdd88, 0.8, 1.2)
    pl.position.y = -0.03; g.add(pl)
    return g
  }

  function easeOut3(t) { return 1 - Math.pow(1 - t, 3) }

  function loop() {
    animId = requestAnimationFrame(loop)
    const t = clock.getElapsedTime()
    if (!waterUniforms) return
    waterUniforms.uTime.value = t

    if (state === 'idle') {
      // Snap bottle back to home position after a launch (scale/pos were trashed)
      if (prevState === 'done') {
        prevState = 'idle'
        bottleGroup.position.set(0.5, 0, 1.5)
        bottleGroup.scale.setScalar(1.8)
        bottleGroup.rotation.set(0, 0, 0)
      }
      // Compute bh AFTER reset so it uses the home position, not the launch endpoint
      const bh = waveH(bottleGroup.position.x, bottleGroup.position.z, t)
      bottleGroup.position.y = bh + 0.15
      const bhe = waveH(bottleGroup.position.x + 0.1, bottleGroup.position.z, t)
      const bhz = waveH(bottleGroup.position.x, bottleGroup.position.z + 0.1, t)
      bottleGroup.rotation.z = Math.atan2(bhe - bh, 0.1) * 0.6 + Math.sin(t * 0.5) * 0.06
      bottleGroup.rotation.x = Math.atan2(bhz - bh, 0.1) * 0.6 + Math.cos(t * 0.4) * 0.05
      bottleGroup.rotation.y = Math.sin(t * 0.22) * 0.10

      camDriftT += 0.003
      camera.position.x = Math.sin(camDriftT * 0.5) * 1.2
      camera.position.y = 3.0 + Math.sin(camDriftT * 0.38) * 0.3
      waterUniforms.uCamPos.value.set(camera.position.x, camera.position.y, camera.position.z)
      camera.lookAt(0, 0, -4)

    } else if (state === 'launching') {
      launchT = Math.min(launchT + 0.008, 1)
      const p = easeOut3(launchT)

      // Parabolic arc: rises to peak at t=0.35 then drops below horizon
      const arcH = launchT < 0.35
        ? (launchT / 0.35) * 8.0                          // rise
        : 8.0 - ((launchT - 0.35) / 0.65) * 10.0         // drop below

      bottleGroup.position.x = 0.5 + p * 30
      bottleGroup.position.z = 1.5 - p * 300
      bottleGroup.position.y = arcH + 0.15
      // Tumbling spin — faster at start, slows as it shrinks
      const spin = (1 - p) * 0.12 + 0.02
      bottleGroup.rotation.x += spin * 1.2
      bottleGroup.rotation.y += spin * 0.5
      bottleGroup.rotation.z += spin * 0.8
      // Shrinks as it goes into distance
      bottleGroup.scale.setScalar(Math.max(1.8 * (1 - p * 0.98), 0.01))

      if (launchT >= 1) {
        prevState = 'done'
        dispatch('sent')
      }
    }

    renderer.render(scene, camera)
  }

  function onResize() {
    if (!renderer || !canvas) return
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
</script>

<canvas bind:this={canvas} style="width:100%;height:100%;display:block"></canvas>
