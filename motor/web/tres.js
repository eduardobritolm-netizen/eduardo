// Peças 3D (Three.js). Cada peça é montada uma vez e animada por tempo.
// Tudo renderiza num canvas WebGL quadrado, que as cenas desenham onde quiserem.
import * as THREE from 'three';

const TAM = 1080;

export function criar3D(tema) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TAM;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(TAM, TAM, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const cor = (c) => new THREE.Color(c);
  const mat = {
    metal: new THREE.MeshStandardMaterial({ color: cor(tema.metal), metalness: 0.85, roughness: 0.28 }),
    madeira: new THREE.MeshStandardMaterial({ color: cor(tema.madeira), metalness: 0.05, roughness: 0.55 }),
    madeiraEscura: new THREE.MeshStandardMaterial({ color: cor(tema.madeira).multiplyScalar(0.6), metalness: 0.05, roughness: 0.6 }),
    destaque: new THREE.MeshStandardMaterial({ color: cor(tema.destaque), metalness: 0.3, roughness: 0.35, emissive: cor(tema.destaque), emissiveIntensity: 0.25 }),
    apagado: new THREE.MeshStandardMaterial({ color: cor(tema.bloco), metalness: 0.1, roughness: 0.6 }),
    papel: new THREE.MeshStandardMaterial({ color: cor(tema.papel), roughness: 0.9 }),
  };

  function palco() {
    const cena = new THREE.Scene();
    cena.add(new THREE.HemisphereLight(0xffffff, cor(tema.bg[1]), 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(3, 6, 4);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.left = sol.shadow.camera.bottom = -5;
    sol.shadow.camera.right = sol.shadow.camera.top = 5;
    sol.shadow.radius = 6;
    cena.add(sol);
    const contra = new THREE.DirectionalLight(cor(tema.destaque), 1.2);
    contra.position.set(-4, 2, -3);
    cena.add(contra);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.28 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    cena.add(chao);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    return { cena, camera, chao };
  }

  const sombra = (m) => { m.castShadow = true; return m; };

  // ---------- Martelo de juiz ----------
  function martelo() {
    const p = palco();
    const base = sombra(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.32, 64), mat.madeira));
    base.position.y = 0.16;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 12, 64), mat.metal);
    aro.rotation.x = Math.PI / 2;
    aro.position.y = 0.22;
    p.cena.add(base, aro);

    const pivo = new THREE.Group(); // gira em torno da ponta do cabo
    pivo.position.set(2.3, 0.62, 0.4);
    const braco = new THREE.Group();
    pivo.add(braco);
    const cabo = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 2.3, 24), mat.madeiraEscura));
    cabo.rotation.z = Math.PI / 2;
    cabo.position.x = -1.15;
    const cabeca = new THREE.Group();
    cabeca.position.x = -2.3;
    const corpo = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.35, 48), mat.madeira));
    corpo.rotation.x = Math.PI / 2;
    cabeca.add(corpo);
    for (const z of [-0.42, 0.42]) {
      const anel = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.1, 48), mat.metal);
      anel.rotation.x = Math.PI / 2;
      anel.position.z = z;
      cabeca.add(anel);
    }
    for (const z of [-0.68, 0.68]) {
      const tampa = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 48), mat.madeiraEscura);
      tampa.rotation.x = Math.PI / 2;
      tampa.position.z = z;
      cabeca.add(tampa);
    }
    braco.add(cabo, cabeca);
    p.cena.add(pivo);
    p.camera.position.set(0.5, 3.0, 6.8);
    p.camera.lookAt(0.5, 0.6, 0);
    const golpe = 0.55;
    return {
      ...p,
      golpe,
      atualizar(u) {
        let ang;
        if (u < golpe) ang = 0.95 * (1 - Math.pow(u / golpe, 3)); // sobe e desce acelerando
        else ang = 0.12 * Math.exp(-7 * (u - golpe)) * Math.abs(Math.sin((u - golpe) * 14));
        braco.rotation.z = -ang;
        p.cena.rotation.y = -0.35 + 0.06 * u;
      },
      pontoImpacto: new THREE.Vector3(0, 0.34, 0.4),
    };
  }

  // ---------- Balança da justiça ----------
  function balanca() {
    const p = palco();
    const g = new THREE.Group();
    const pe = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.22, 64), mat.metal));
    pe.position.y = 0.11;
    const degrau = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.18, 64), mat.metal));
    degrau.position.y = 0.3;
    const haste = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.0, 24), mat.metal));
    haste.position.y = 1.85;
    const topo = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16), mat.metal));
    topo.position.y = 3.5;
    g.add(pe, degrau, haste, topo);

    const travessa = new THREE.Group();
    travessa.position.y = 3.3;
    const barra = sombra(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.08), mat.metal));
    travessa.add(barra);
    g.add(travessa);

    const pratos = [];
    for (const lado of [-1, 1]) {
      const conj = new THREE.Group();
      const prato = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.42, 0.14, 48, 1, true), mat.metal));
      prato.material = mat.metal.clone();
      prato.material.side = THREE.DoubleSide;
      const fundo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), mat.metal);
      fundo.rotation.x = -Math.PI / 2;
      fundo.position.y = -0.07;
      prato.position.y = -1.3;
      fundo.position.y = -1.37;
      conj.add(prato, fundo);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const fim = new THREE.Vector3(Math.cos(a) * 0.6, -1.24, Math.sin(a) * 0.6);
        const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, fim.length(), 6), mat.metal);
        corda.position.copy(fim.clone().multiplyScalar(0.5));
        corda.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fim.clone().normalize());
        conj.add(corda);
      }
      g.add(conj);
      pratos.push({ conj, lado });
    }
    p.cena.add(g);
    p.camera.position.set(0, 2.4, 7.6);
    p.camera.lookAt(0, 1.85, 0);
    return {
      ...p,
      atualizar(u, d, params) {
        const pende = params.pende || 'equilibrio';
        const alvo = pende === 'esquerda' ? 0.2 : pende === 'direita' ? -0.2 : 0;
        const v = Math.max(0, u - 0.5);
        let ang = alvo * (1 - Math.exp(-2.4 * v) * Math.cos(6 * v));
        if (u < 0.5 || pende === 'equilibrio') ang += 0.12 * Math.exp(-1.6 * u) * Math.sin(5 * u);
        travessa.rotation.z = ang;
        for (const pr of pratos) {
          const x = Math.cos(ang) * 1.65 * pr.lado;
          const y = 3.3 + Math.sin(ang) * 1.65 * pr.lado;
          pr.conj.position.set(x, y, 0);
        }
        g.rotation.y = Math.sin(u * 0.6) * 0.12;
      },
      pratos: () => pratos.map((pr) => pr.conj.localToWorld(new THREE.Vector3(0, -1.45, 0))),
    };
  }

  // ---------- Grade de cubos (prazos, quantidades) ----------
  const cubosCache = new Map();
  function cubos(n) {
    if (cubosCache.has(n)) return cubosCache.get(n);
    const p = palco();
    const vis = Math.max(1, Math.min(n, 60));
    const colunas = vis <= 7 ? vis : Math.ceil(Math.sqrt(vis * 1.8));
    const linhas = Math.ceil(vis / colunas);
    const passo = 0.62;
    const lista = [];
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < vis; i++) {
      const c = i % colunas, l = Math.floor(i / colunas);
      const m = sombra(new THREE.Mesh(geo, mat.apagado));
      m.userData.base = new THREE.Vector3((c - (colunas - 1) / 2) * passo, 0.25, (l - (linhas - 1) / 2) * passo);
      p.cena.add(m);
      lista.push(m);
    }
    const largura = Math.max(colunas, linhas * 1.3) * passo;
    p.camera.position.set(0, largura * 0.75 + 1.0, largura * 0.95 + 1.6);
    p.camera.lookAt(0, 0, 0);
    const obj = {
      ...p,
      atualizar(u, d, params, progresso) {
        lista.forEach((m, i) => {
          const k = Math.min(1, Math.max(0, (u - 0.15 - i * (0.9 / vis)) / 0.35));
          const salto = 1 - Math.pow(1 - k, 3);
          m.position.copy(m.userData.base);
          m.position.y = 0.25 + (1 - salto) * 2.5;
          m.scale.setScalar(Math.max(0.001, salto));
          const aceso = i < Math.round(progresso * vis);
          m.material = aceso ? mat.destaque : mat.apagado;
          if (aceso) m.position.y += 0.08 * Math.sin(u * 4 + i * 0.5) * 0.5;
        });
        p.cena.rotation.y = -0.25 + 0.08 * u;
      },
    };
    cubosCache.set(n, obj);
    return obj;
  }

  // ---------- Pilha de livros (códigos) ----------
  function livros() {
    const p = palco();
    const cores = [tema.livro1, tema.livro2, tema.livro3, tema.livro1];
    const pilha = new THREE.Group();
    let y = 0;
    const dims = [[2.6, 0.42, 1.8], [2.4, 0.36, 1.7], [2.7, 0.48, 1.85], [2.2, 0.32, 1.6]];
    dims.forEach(([w, h, dz], i) => {
      const livro = new THREE.Group();
      const capa = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, h, dz), new THREE.MeshStandardMaterial({ color: cor(cores[i]), roughness: 0.55 })));
      const folhas = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.08, dz - 0.02), mat.papel);
      folhas.position.x = 0.05;
      const faixa = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.3, dz * 1.002), mat.metal);
      faixa.position.x = -w / 2 - 0.001;
      const faixa2 = faixa.clone();
      faixa.position.y = h * 0.22;
      faixa2.position.y = -h * 0.22;
      livro.add(capa, folhas, faixa, faixa2);
      livro.position.y = y + h / 2;
      livro.rotation.y = [0.05, -0.12, 0.1, -0.2][i];
      livro.userData.alvoY = livro.position.y;
      y += h;
      pilha.add(livro);
    });
    p.cena.add(pilha);
    p.camera.position.set(0, 2.7, 5.4);
    p.camera.lookAt(0, 0.75, 0);
    return {
      ...p,
      atualizar(u) {
        pilha.children.forEach((l, i) => {
          const k = Math.min(1, Math.max(0, (u - i * 0.12) / 0.45));
          const e = 1 - Math.pow(1 - k, 3);
          l.position.y = l.userData.alvoY + (1 - e) * 3;
          l.visible = k > 0;
        });
        pilha.rotation.y = -0.5 + u * 0.15;
      },
    };
  }

  const fabricas = { martelo, balanca, livros };
  const prontos = new Map();

  return {
    canvas,
    /** Renderiza a peça `nome` no tempo local u. Devolve funções de projeção. */
    render(nome, u, d, params = {}, extra) {
      let obj;
      if (nome === 'cubos') obj = cubos(extra?.n ?? 10);
      else {
        if (!prontos.has(nome)) prontos.set(nome, fabricas[nome]());
        obj = prontos.get(nome);
      }
      obj.atualizar(u, d, params, extra?.progresso ?? 1);
      renderer.setClearColor(0x000000, 0);
      renderer.render(obj.cena, obj.camera);
      const projetar = (v) => {
        const q = v.clone().project(obj.camera);
        return { x: (q.x * 0.5 + 0.5), y: (-q.y * 0.5 + 0.5) };
      };
      return { obj, projetar };
    },
  };
}
