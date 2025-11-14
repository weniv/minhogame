// 로컬스토리지에서 돈 로드
function loadMoney() {
    const savedMoney = localStorage.getItem('gameMoney');
    return savedMoney ? parseInt(savedMoney) : 0;
}

// 로컬스토리지에 돈 저장
function saveMoney(amount) {
    localStorage.setItem('gameMoney', amount.toString());
}

// 게임 상태
const gameState = {
    health: 100,
    maxHealth: 100,
    money: loadMoney(),
    isAiming: false,
    isReloading: false,
    currentWeapon: 'assault',
    ownedWeapons: ['assault', 'pistol', 'knife', 'grenade'],
    wave: 1,
    zombiesKilled: 0,
    isGameOver: false,
    zombiesInCurrentWave: 0,
    zombiesSpawnedInWave: 0,
    isWaitingForNextWave: false,
    isGameStarted: false,  // 게임 시작 여부
    isPaused: false,  // 게임 일시정지 여부
    speedMultiplier: 1.0,  // 이동 속도 배율
};

// 무기 설정
const weapons = {
    assault: {
        name: '돌격소총',
        damage: 13,
        headshotMultiplier: 1,
        magazineSize: 30,
        reserveAmmo: 90,
        currentAmmo: 30,
        fireRate: 100,
        reloadTime: 2000,
        price: 0,
        type: 'gun',
    },
    pistol: {
        name: '권총',
        damage: 20,
        headshotMultiplier: 1.5,
        magazineSize: 12,
        reserveAmmo: 48,
        currentAmmo: 12,
        fireRate: 300,
        reloadTime: 1500,
        price: 0,
        type: 'gun',
    },
    knife: {
        name: '칼',
        damage: 60,
        headshotMultiplier: 1,
        magazineSize: 1,
        reserveAmmo: 999,
        currentAmmo: 1,
        fireRate: 500,
        reloadTime: 0,
        price: 0,
        type: 'melee',
        range: 3,
    },
    grenade: {
        name: '수류탄',
        damage: 150,
        headshotMultiplier: 1,
        magazineSize: 1,
        reserveAmmo: 3,
        currentAmmo: 1,
        fireRate: 1000,
        reloadTime: 1000,
        price: 0,
        type: 'explosive',
        explosionRadius: 5,
    },
    revolver: {
        name: '리볼버',
        damage: 45,
        headshotDamage: 90,
        magazineSize: 6,
        reserveAmmo: 24,
        currentAmmo: 6,
        fireRate: 600,
        reloadTime: 2000,
        price: 3000,
        type: 'gun',
    },
    autopistol: {
        name: '연사권총',
        damage: 18,
        headshotMultiplier: 1.2,
        magazineSize: 20,
        reserveAmmo: 60,
        currentAmmo: 20,
        fireRate: 80,
        reloadTime: 1800,
        price: 2500,
        type: 'gun',
    },
    crossbow: {
        name: '크로스보우',
        damage: 49,
        headshotDamage: 70,
        magazineSize: 1,
        reserveAmmo: 20,
        currentAmmo: 1,
        fireRate: 1000,
        reloadTime: 1500,
        price: 4000,
        type: 'gun',
    },
    sniper: {
        name: '저격총',
        damage: 50,
        headshotDamage: 500,
        magazineSize: 5,
        reserveAmmo: 15,
        currentAmmo: 5,
        fireRate: 800,
        reloadTime: 2500,
        price: 7000,
        type: 'gun',
    }
};

// Three.js 기본 설정
let scene, camera, renderer;
let player, playerVelocity;
let zombies = [];
let blocks = [];
let keys = {};
let canShoot = true;
let lastShotTime = 0;
let clock;
let grenades = [];

// 물리 설정
const GRAVITY = -0.015;
const JUMP_FORCE = 0.25;
const MOVE_SPEED = 0.1;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.5;

// 좀비 설정
const ZOMBIE_SPEED = 0.03;
const ZOMBIE_ATTACK_RANGE = 2;
const ZOMBIE_ATTACK_DAMAGE = 10;
const ZOMBIE_ATTACK_COOLDOWN = 1000;

// 초기화
function init() {
    clock = new THREE.Clock();

    // Scene 생성
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 0, 80);

    // Camera 생성
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    // 카메라 회전 순서를 YXZ로 설정하여 대각선 회전 방지
    camera.rotation.order = 'YXZ';

    // Renderer 생성
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 조명 (어두운 분위기)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xff9966, 0.6);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 플레이어 초기화
    player = {
        position: new THREE.Vector3(0, 1.8, 0),
        rotation: new THREE.Euler(0, 0, 0),
        onGround: true
    };

    playerVelocity = new THREE.Vector3(0, 0, 0);
    camera.position.copy(player.position);

    // 맵 생성
    createMap();

    // 이벤트 리스너
    setupEventListeners();

    // UI 업데이트
    updateUI();

    // 게임 루프 시작
    animate();
}

// 블록 형태의 맵 생성
function createMap() {
    // 바닥
    const groundGeometry = new THREE.BoxGeometry(60, 1, 60);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x2d3436 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    blocks.push(ground);

    // 벽과 장애물 (블록 형태)
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });

    // 경계 벽
    createWall(0, 2, -30, 60, 4, 1, wallMaterial); // 뒤
    createWall(0, 2, 30, 60, 4, 1, wallMaterial);  // 앞
    createWall(-30, 2, 0, 1, 4, 60, wallMaterial); // 왼쪽
    createWall(30, 2, 0, 1, 4, 60, wallMaterial);  // 오른쪽

    // 내부 장애물 블록들
    const obstaclePositions = [
        [-15, 1, -15], [15, 1, -15], [-15, 1, 15], [15, 1, 15],
        [0, 1, -20], [0, 1, 20], [-20, 1, 0], [20, 1, 0],
        [-8, 1, -8], [8, 1, 8], [-8, 1, 8], [8, 1, -8],
        [-10, 1, 0], [10, 1, 0], [0, 1, -10], [0, 1, 10]
    ];

    obstaclePositions.forEach(pos => {
        createBlock(pos[0], pos[1], pos[2], 3, 2, 3, 0x5d4037);
    });

    // 플랫폼
    createBlock(-20, 3, -20, 5, 1, 5, 0x6d4c41);
    createBlock(20, 3, 20, 5, 1, 5, 0x6d4c41);
}

function createWall(x, y, z, width, height, depth, material) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    blocks.push(wall);
}

function createBlock(x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    blocks.push(block);
}

// 좀비 웨이브 생성 - 웨이브 번호만큼 좀비 생성
function spawnWave() {
    const zombieCount = gameState.wave;
    gameState.zombiesInCurrentWave = zombieCount;
    gameState.zombiesSpawnedInWave = 0;

    showMessage(`웨이브 ${gameState.wave} - 좀비 ${zombieCount}마리!`);

    for (let i = 0; i < zombieCount; i++) {
        setTimeout(() => {
            spawnZombie();
            gameState.zombiesSpawnedInWave++;
        }, i * 500);
    }
}

// 좀비 생성
function spawnZombie() {
    const zombie = new THREE.Group();

    // 좀비 색상 (부패한 회색-녹색 톤)
    const zombieBodyColor = 0x6b7c5d;  // 어두운 올리브 그린
    const zombieSkinColor = 0x8b9378;  // 부패한 피부색
    const zombieDarkColor = 0x4a5842;  // 더 어두운 부분

    // 몸통 (좀비 몸)
    const bodyGeometry = new THREE.BoxGeometry(0.7, 1.0, 0.4);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: zombieBodyColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.7;
    body.castShadow = true;
    body.name = 'body';
    zombie.add(body);

    // 머리 (좀비 머리 - 약간 크고 기울어짐)
    const headGeometry = new THREE.BoxGeometry(0.55, 0.65, 0.5);
    const headMaterial = new THREE.MeshLambertMaterial({ color: zombieSkinColor });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    head.rotation.x = -0.1; // 약간 앞으로 기울임
    head.castShadow = true;
    head.name = 'head';
    zombie.add(head);

    // 눈 (빨간 눈)
    const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.05);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 1.55, 0.26);
    zombie.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 1.55, 0.26);
    zombie.add(rightEye);

    // 입 (어두운 입)
    const mouthGeometry = new THREE.BoxGeometry(0.3, 0.08, 0.05);
    const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, 1.35, 0.26);
    zombie.add(mouth);

    // 팔 (좀비처럼 앞으로 뻗은 포즈)
    const armGeometry = new THREE.BoxGeometry(0.18, 0.85, 0.18);
    const armMaterial = new THREE.MeshLambertMaterial({ color: zombieSkinColor });

    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.45, 0.8, 0.3);
    leftArm.rotation.x = -Math.PI / 3; // 앞으로 뻗음
    leftArm.rotation.z = Math.PI / 8;
    leftArm.castShadow = true;
    leftArm.name = 'leftArm';
    zombie.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.45, 0.8, 0.3);
    rightArm.rotation.x = -Math.PI / 3; // 앞으로 뻗음
    rightArm.rotation.z = -Math.PI / 8;
    rightArm.castShadow = true;
    rightArm.name = 'rightArm';
    zombie.add(rightArm);

    // 다리 (좀비 다리)
    const legGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const legMaterial = new THREE.MeshLambertMaterial({ color: zombieDarkColor });

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.2, 0.0, 0);
    leftLeg.castShadow = true;
    zombie.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.2, 0.0, 0);
    rightLeg.castShadow = true;
    zombie.add(rightLeg);

    // 랜덤 스폰 위치 (맵 가장자리)
    const side = Math.floor(Math.random() * 4);
    let x, z;

    switch(side) {
        case 0: // 북쪽
            x = (Math.random() - 0.5) * 50;
            z = -28;
            break;
        case 1: // 남쪽
            x = (Math.random() - 0.5) * 50;
            z = 28;
            break;
        case 2: // 서쪽
            x = -28;
            z = (Math.random() - 0.5) * 50;
            break;
        case 3: // 동쪽
            x = 28;
            z = (Math.random() - 0.5) * 50;
            break;
    }

    zombie.position.set(x, 0, z);

    zombie.userData = {
        health: 100,
        maxHealth: 100,
        isAlive: true,
        speed: ZOMBIE_SPEED * (0.8 + Math.random() * 0.4),
        lastAttackTime: 0,
        animationOffset: Math.random() * Math.PI * 2
    };

    scene.add(zombie);
    zombies.push(zombie);
}

// 좀비 AI 업데이트
function updateZombies(deltaTime) {
    if (gameState.isGameOver || gameState.isWaitingForNextWave || !gameState.isGameStarted || gameState.isPaused) return;

    const time = clock.getElapsedTime();

    zombies.forEach(zombie => {
        if (!zombie.userData.isAlive) return;

        // 플레이어 방향으로 이동
        const direction = new THREE.Vector3();
        direction.subVectors(player.position, zombie.position);
        direction.y = 0;

        const distance = direction.length();
        direction.normalize();

        // 좀비가 플레이어를 바라보도록
        zombie.rotation.y = Math.atan2(direction.x, direction.z);

        // 공격 범위 체크
        if (distance < ZOMBIE_ATTACK_RANGE) {
            // 공격
            const currentTime = Date.now();
            if (currentTime - zombie.userData.lastAttackTime > ZOMBIE_ATTACK_COOLDOWN) {
                zombie.userData.lastAttackTime = currentTime;
                attackPlayer();

                // 공격 애니메이션 - 몸통과 팔만 앞으로
                zombie.children.forEach(child => {
                    if (child.name === 'body' || child.name === 'leftArm' || child.name === 'rightArm') {
                        const originalZ = child.position.z;
                        child.position.z = originalZ + 0.2;
                        setTimeout(() => {
                            child.position.z = originalZ;
                        }, 200);
                    }
                });
            }
        } else {
            // 플레이어 쪽으로 이동 (비틀거리는 움직임)
            const wobble = Math.sin(time * 3 + zombie.userData.animationOffset) * 0.02;

            // 새로운 위치 계산
            const newX = zombie.position.x + direction.x * zombie.userData.speed + wobble;
            const newZ = zombie.position.z + direction.z * zombie.userData.speed + wobble;

            // 충돌 검사
            const ZOMBIE_RADIUS = 0.5;
            let canMoveX = true;
            let canMoveZ = true;

            for (let block of blocks) {
                const blockBox = new THREE.Box3().setFromObject(block);

                // 수직 벽인지 확인 (바닥/천장 제외)
                const zombieBottom = zombie.position.y;
                const zombieTop = zombie.position.y + 2;
                const isVerticalWall = blockBox.max.y > zombieBottom + 0.1 && blockBox.min.y < zombieTop - 0.1;

                if (isVerticalWall) {
                    // X축 충돌 검사
                    const testBoxX = new THREE.Box3(
                        new THREE.Vector3(newX - ZOMBIE_RADIUS, zombieBottom, zombie.position.z - ZOMBIE_RADIUS),
                        new THREE.Vector3(newX + ZOMBIE_RADIUS, zombieTop, zombie.position.z + ZOMBIE_RADIUS)
                    );
                    if (blockBox.intersectsBox(testBoxX)) {
                        canMoveX = false;
                    }

                    // Z축 충돌 검사
                    const testBoxZ = new THREE.Box3(
                        new THREE.Vector3(zombie.position.x - ZOMBIE_RADIUS, zombieBottom, newZ - ZOMBIE_RADIUS),
                        new THREE.Vector3(zombie.position.x + ZOMBIE_RADIUS, zombieTop, newZ + ZOMBIE_RADIUS)
                    );
                    if (blockBox.intersectsBox(testBoxZ)) {
                        canMoveZ = false;
                    }
                }
            }

            // 충돌하지 않으면 이동
            if (canMoveX) {
                zombie.position.x = newX;
            } else {
                // X축이 막혔으면 Z축으로만 이동 시도 (장애물 돌아가기)
                zombie.position.z += direction.z * zombie.userData.speed * 1.5;
            }

            if (canMoveZ) {
                zombie.position.z = newZ;
            } else {
                // Z축이 막혔으면 X축으로만 이동 시도 (장애물 돌아가기)
                zombie.position.x += direction.x * zombie.userData.speed * 1.5;
            }

            // 걷기 애니메이션 (좀비처럼 비틀거림)
            const walkCycle = time * 4 + zombie.userData.animationOffset;
            const walkAnimation = Math.sin(walkCycle) * 0.08;
            zombie.position.y = Math.abs(walkAnimation);

            // 좀비 몸 전체 좌우로 흔들림
            zombie.rotation.z = Math.sin(walkCycle * 0.5) * 0.1;
            zombie.rotation.x = Math.sin(walkCycle * 0.7) * 0.05;

            // 머리 좌우로 흔들림
            const head = zombie.children.find(child => child.name === 'head');
            if (head) {
                head.rotation.y = Math.sin(walkCycle * 0.8) * 0.15;
                head.rotation.z = Math.sin(walkCycle * 0.6) * 0.1;
            }
        }
    });

    // 죽은 좀비 제거
    zombies = zombies.filter(zombie => zombie.userData.isAlive || zombie.parent);

    // 웨이브의 모든 좀비가 스폰되고 모두 처치되면 웨이브 클리어
    if (zombies.length === 0 &&
        gameState.zombiesSpawnedInWave === gameState.zombiesInCurrentWave &&
        gameState.zombiesInCurrentWave > 0 &&
        !gameState.isWaitingForNextWave) {
        completeWave();
    }
}

// 수류탄 업데이트
function updateGrenades(deltaTime) {
    grenades.forEach((grenade, index) => {
        if (!grenade.userData.active) return;

        // 중력 적용
        grenade.userData.velocity.y += GRAVITY;

        // 위치 업데이트
        grenade.position.add(grenade.userData.velocity);

        // 회전
        grenade.rotation.x += 0.1;
        grenade.rotation.y += 0.1;

        // 바닥 충돌 체크
        if (grenade.position.y <= 0.5) {
            explodeGrenade(grenade);
            scene.remove(grenade);
            grenade.userData.active = false;
        }

        // 시간 초과
        if (Date.now() - grenade.userData.throwTime > 3000) {
            explodeGrenade(grenade);
            scene.remove(grenade);
            grenade.userData.active = false;
        }
    });

    // 비활성 수류탄 제거
    grenades = grenades.filter(g => g.userData.active);
}

// 수류탄 폭발
function explodeGrenade(grenade) {
    const explosionRadius = weapons.grenade.explosionRadius;
    const damage = weapons.grenade.damage;

    // 폭발 이펙트
    const explosionGeometry = new THREE.SphereGeometry(explosionRadius, 16, 16);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.7
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(grenade.position);
    scene.add(explosion);

    // 폭발 애니메이션
    let scale = 0.1;
    const explosionInterval = setInterval(() => {
        scale += 0.3;
        explosion.scale.set(scale, scale, scale);
        explosion.material.opacity -= 0.1;

        if (explosion.material.opacity <= 0) {
            clearInterval(explosionInterval);
            scene.remove(explosion);
        }
    }, 50);

    // 범위 내 좀비에게 데미지
    zombies.forEach(zombie => {
        if (!zombie.userData.isAlive) return;

        const distance = zombie.position.distanceTo(grenade.position);
        if (distance <= explosionRadius) {
            zombie.userData.health -= damage;
            showDamage(zombie.position, damage, false);

            if (zombie.userData.health <= 0) {
                killZombie(zombie);
            }
        }
    });
}

// 플레이어 공격
function attackPlayer() {
    if (gameState.isGameOver || !gameState.isGameStarted) return;

    gameState.health -= ZOMBIE_ATTACK_DAMAGE;
    updateUI();

    // 화면 빨간 효과
    flashScreen();

    if (gameState.health <= 0) {
        gameOver();
    }
}

// 화면 깜빡임 효과
function flashScreen() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'rgba(255, 0, 0, 0.3)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
    }, 200);
}

// 게임 오버
function gameOver() {
    gameState.isGameOver = true;

    // 게임 오버 화면 표시
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-wave').textContent = gameState.wave;
    document.getElementById('final-kills').textContent = gameState.zombiesKilled;
    document.getElementById('final-money').textContent = gameState.money;

    document.exitPointerLock();
}

// 게임 재시작
function restartGame() {
    // 게임 오버 화면 숨김
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('next-wave-screen').classList.add('hidden');

    // 게임 상태 리셋
    gameState.health = gameState.maxHealth;
    gameState.wave = 1;
    gameState.zombiesKilled = 0;
    gameState.isGameOver = false;
    gameState.zombiesInCurrentWave = 0;
    gameState.zombiesSpawnedInWave = 0;
    gameState.isWaitingForNextWave = false;
    gameState.isGameStarted = true;  // 재시작 시 바로 게임 시작
    gameState.speedMultiplier = 1.0;  // 이동 속도 초기화

    // 모든 좀비 제거
    zombies.forEach(zombie => scene.remove(zombie));
    zombies = [];

    // 모든 수류탄 제거
    grenades.forEach(grenade => scene.remove(grenade));
    grenades = [];

    // 플레이어 위치 리셋
    player.position.set(0, 1.8, 0);
    player.rotation.set(0, 0, 0);
    player.onGround = true;
    playerVelocity.set(0, 0, 0);

    // 무기 탄약 리셋
    Object.keys(weapons).forEach(key => {
        const weapon = weapons[key];
        weapon.currentAmmo = weapon.magazineSize;
        if (key === 'assault') weapon.reserveAmmo = 90;
        if (key === 'pistol') weapon.reserveAmmo = 48;
        if (key === 'knife') weapon.reserveAmmo = 999;
        if (key === 'grenade') weapon.reserveAmmo = 3;
        if (key === 'revolver') weapon.reserveAmmo = 24;
        if (key === 'autopistol') weapon.reserveAmmo = 60;
        if (key === 'crossbow') weapon.reserveAmmo = 20;
        if (key === 'sniper') weapon.reserveAmmo = 15;
    });

    gameState.currentWeapon = 'assault';

    // UI 업데이트
    updateUI();

    // 첫 웨이브 시작
    spawnWave();

    // 포인터락 재시작
    document.body.requestPointerLock();
}

// 웨이브 완료
function completeWave() {
    gameState.isWaitingForNextWave = true;
    gameState.money += 500;
    saveMoney(gameState.money);

    showMessage(`웨이브 ${gameState.wave} 클리어! +500원`);

    // 다음 웨이브 버튼 표시
    document.getElementById('next-wave-screen').classList.remove('hidden');
    document.exitPointerLock();

    updateUI();
}

// 다음 웨이브 시작
function startNextWave() {
    gameState.isWaitingForNextWave = false;
    gameState.wave++;

    // 버튼 숨기기
    document.getElementById('next-wave-screen').classList.add('hidden');

    // 다음 웨이브 시작
    spawnWave();

    // 포인터락 재시작
    document.body.requestPointerLock();

    updateUI();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 키보드
    document.addEventListener('keydown', (e) => {
        if (gameState.isGameOver) return;

        keys[e.key] = true;

        // 메뉴/상점 상태 확인
        const shopOpen = !document.getElementById('weapon-shop').classList.contains('hidden');
        const settingsOpen = !document.getElementById('settings-menu').classList.contains('hidden');
        const nextWaveOpen = !document.getElementById('next-wave-screen').classList.contains('hidden');

        // 다음 웨이브 화면에서 Enter 키
        if (nextWaveOpen && e.key === 'Enter') {
            startNextWave();
            return;
        }

        // 설정 메뉴에서 키 처리
        if (settingsOpen) {
            handleSettingsMenuKeys(e);
            return;
        }

        // M키 - 설정 메뉴 토글 (상점이 닫혀있을 때만)
        if ((e.key === 'm' || e.key === 'M') && !shopOpen) {
            toggleSettings();
            return;
        }

        // R키 - 재장전
        if ((e.key === 'r' || e.key === 'R') && !shopOpen && !settingsOpen) {
            reload();
        }

        // 무기 선택 - 상점이 닫혀있을 때만 가능
        if (!shopOpen) {
            if (e.key === '1' && gameState.ownedWeapons.includes('assault')) {
                gameState.currentWeapon = 'assault';
                updateUI();
            }
            if (e.key === '2' && gameState.ownedWeapons.includes('pistol')) {
                gameState.currentWeapon = 'pistol';
                updateUI();
            }
            if (e.key === '3' && gameState.ownedWeapons.includes('knife')) {
                gameState.currentWeapon = 'knife';
                updateUI();
            }
            if (e.key === '4' && gameState.ownedWeapons.includes('grenade')) {
                gameState.currentWeapon = 'grenade';
                updateUI();
            }
            if (e.key === '5' && gameState.ownedWeapons.includes('revolver')) {
                gameState.currentWeapon = 'revolver';
                updateUI();
            }
            if (e.key === '6' && gameState.ownedWeapons.includes('autopistol')) {
                gameState.currentWeapon = 'autopistol';
                updateUI();
            }
            if (e.key === '7' && gameState.ownedWeapons.includes('crossbow')) {
                gameState.currentWeapon = 'crossbow';
                updateUI();
            }
            if (e.key === '8' && gameState.ownedWeapons.includes('sniper')) {
                gameState.currentWeapon = 'sniper';
                updateUI();
            }
        }

        // 상점 열기/닫기 (E키 열기, Q키 닫기)
        if (e.key === 'e' || e.key === 'E') {
            toggleShop();
        }

        // 상점에서 Q키로 닫기
        if (shopOpen && (e.key === 'q' || e.key === 'Q')) {
            toggleShop();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

    // 마우스
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    // 클릭으로 포인터락 시작
    document.getElementById('loading-screen').addEventListener('click', () => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.body.requestPointerLock();

        // 게임 시작
        if (!gameState.isGameStarted) {
            gameState.isGameStarted = true;
            spawnWave();  // 첫 웨이브 시작
        }
    });

    // 재시작 버튼
    document.getElementById('restart-button').addEventListener('click', () => {
        restartGame();
    });

    // 다음 웨이브 시작 버튼
    document.getElementById('start-next-wave-button').addEventListener('click', () => {
        startNextWave();
    });

    // 무기 상점
    setupShop();

    // 설정 메뉴
    setupSettings();

    // 창 크기 변경
    window.addEventListener('resize', onWindowResize);
}

// 마우스 이동
function onMouseMove(event) {
    if (document.pointerLockElement === document.body && !gameState.isGameOver) {
        const sensitivity = 0.002;
        player.rotation.y -= event.movementX * sensitivity;
        player.rotation.x -= event.movementY * sensitivity;
        player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
    }
}

// 마우스 클릭
function onMouseDown(event) {
    // 포인터락이 없으면 재요청
    if (document.pointerLockElement !== document.body) {
        if (!gameState.isGameOver && gameState.isGameStarted) {
            document.body.requestPointerLock();
        }
        return;
    }

    if (gameState.isGameOver) return;

    // 좌클릭 - 발사
    if (event.button === 0) {
        shoot();
    }

    // 우클릭 - 조준
    if (event.button === 2) {
        gameState.isAiming = true;
        document.getElementById('crosshair').classList.add('aiming');
        // 조준 시 FOV 줄여서 확대
        camera.fov = 50;
        camera.updateProjectionMatrix();
    }
}

function onMouseUp(event) {
    // 우클릭 - 조준 해제
    if (event.button === 2) {
        gameState.isAiming = false;
        document.getElementById('crosshair').classList.remove('aiming');
        // 조준 해제 시 FOV 원래대로
        camera.fov = 75;
        camera.updateProjectionMatrix();
    }
}

// 발사
function shoot() {
    if (gameState.isReloading || gameState.isGameOver || !gameState.isGameStarted || gameState.isPaused) return;

    const weapon = weapons[gameState.currentWeapon];

    if (weapon.currentAmmo <= 0) {
        showMessage('탄약 없음! R키로 장전하세요');
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastShotTime < weapon.fireRate) {
        return;
    }

    lastShotTime = currentTime;

    // 무기 타입별 처리
    if (weapon.type === 'grenade') {
        throwGrenade();
        weapon.currentAmmo--;
        updateUI();
        return;
    }

    if (weapon.type === 'melee') {
        meleeAttack();
        return;
    }

    // 총기류
    weapon.currentAmmo--;
    updateUI();

    // 레이캐스팅으로 좀비 탐지
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyEuler(camera.rotation);

    raycaster.set(camera.position, direction);

    // 좀비와의 교차 검사
    for (let zombie of zombies) {
        if (!zombie.userData.isAlive) continue;

        const intersects = raycaster.intersectObjects(zombie.children, true);

        if (intersects.length > 0) {
            const hitPart = intersects[0].object;
            let damage = weapon.damage;
            let isHeadshot = false;

            if (hitPart.name === 'head') {
                isHeadshot = true;
                damage = weapon.headshotDamage || weapon.damage * (weapon.headshotMultiplier || 1);
            }

            zombie.userData.health -= damage;
            showDamage(intersects[0].point, damage, isHeadshot);

            // 피격 효과
            const originalColor = hitPart.material.color.getHex();
            hitPart.material.color.setHex(0xffff00);
            setTimeout(() => {
                hitPart.material.color.setHex(originalColor);
            }, 100);

            if (zombie.userData.health <= 0) {
                killZombie(zombie);
            }

            break;
        }
    }

    // 총알 발사 효과
    createBulletTracer(camera.position.clone(), direction);

    // 총소리 효과 (화면 흔들림)
    cameraShake();
}

// 좀비 처치
function killZombie(zombie) {
    zombie.userData.isAlive = false;

    // 좀비 죽는 애니메이션
    let fallRotation = 0;
    const fallInterval = setInterval(() => {
        fallRotation += 0.1;
        zombie.rotation.x = fallRotation;
        zombie.position.y -= 0.05;

        if (fallRotation >= Math.PI / 2) {
            clearInterval(fallInterval);
            setTimeout(() => {
                scene.remove(zombie);
            }, 2000);
        }
    }, 16);

    gameState.money += 100;
    saveMoney(gameState.money);
    gameState.zombiesKilled++;
    showMessage('+100원');
    updateUI();
}

// 근접 공격
function meleeAttack() {
    const weapon = weapons.knife;
    const range = weapon.range;

    // 범위 내 좀비 찾기
    for (let zombie of zombies) {
        if (!zombie.userData.isAlive) continue;

        const distance = player.position.distanceTo(zombie.position);
        if (distance <= range) {
            zombie.userData.health -= weapon.damage;
            showDamage(zombie.position, weapon.damage, false);

            if (zombie.userData.health <= 0) {
                killZombie(zombie);
            }
            break;
        }
    }

    // 칼 휘두르기 애니메이션 (화면 흔들림)
    cameraShake();
}

// 수류탄 투척
function throwGrenade() {
    const grenadeGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const grenadeMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const grenade = new THREE.Mesh(grenadeGeometry, grenadeMaterial);

    grenade.position.copy(camera.position);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyEuler(camera.rotation);

    grenade.userData = {
        velocity: direction.multiplyScalar(0.3).add(new THREE.Vector3(0, 0.1, 0)),
        active: true,
        throwTime: Date.now()
    };

    scene.add(grenade);
    grenades.push(grenade);
}

// 카메라 흔들림
function cameraShake() {
    const originalPos = camera.position.clone();
    const shakeAmount = 0.05;
    const shakeDuration = 50;

    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.y += (Math.random() - 0.5) * shakeAmount;

    setTimeout(() => {
        camera.position.copy(originalPos);
    }, shakeDuration);
}

// 총알 궤적 효과
function createBulletTracer(start, direction) {
    const end = start.clone().add(direction.multiplyScalar(100));
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    setTimeout(() => {
        scene.remove(line);
    }, 50);
}

// 데미지 표시
function showDamage(position, damage, isHeadshot) {
    const damageEl = document.createElement('div');
    damageEl.className = 'damage-number' + (isHeadshot ? ' headshot' : '');
    damageEl.textContent = Math.round(damage);

    // 3D 위치를 2D 화면 좌표로 변환
    const screenPos = position.clone().project(camera);
    damageEl.style.left = ((screenPos.x + 1) / 2 * window.innerWidth) + 'px';
    damageEl.style.top = ((-screenPos.y + 1) / 2 * window.innerHeight) + 'px';

    document.getElementById('game-ui').appendChild(damageEl);

    setTimeout(() => {
        damageEl.remove();
    }, 1000);
}

// 메시지 표시
function showMessage(text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'game-message';
    messageEl.textContent = text;

    const container = document.getElementById('game-messages');
    container.appendChild(messageEl);

    setTimeout(() => {
        messageEl.remove();
    }, 2000);
}

// 장전
function reload() {
    if (gameState.isReloading) return;

    const weapon = weapons[gameState.currentWeapon];

    if (weapon.type === 'melee') {
        return; // 칼은 장전 불필요
    }

    if (weapon.currentAmmo === weapon.magazineSize) {
        showMessage('탄약이 가득 찼습니다');
        return;
    }

    if (weapon.reserveAmmo <= 0) {
        showMessage('예비 탄약 없음');
        return;
    }

    gameState.isReloading = true;
    showMessage('장전 중...');

    setTimeout(() => {
        const needed = weapon.magazineSize - weapon.currentAmmo;
        const toReload = Math.min(needed, weapon.reserveAmmo);

        weapon.currentAmmo += toReload;
        weapon.reserveAmmo -= toReload;

        gameState.isReloading = false;
        updateUI();
        showMessage('장전 완료');
    }, weapon.reloadTime);
}

// 무기 상점
function setupShop() {
    const shopItems = document.querySelectorAll('#weapon-shop .shop-item');

    shopItems.forEach(item => {
        const itemType = item.dataset.type;
        const weaponType = item.dataset.weapon;
        const ammoType = item.dataset.ammo;
        const potionType = item.dataset.potion;
        const price = parseInt(item.dataset.price);
        const buyButton = item.querySelector('.buy-button');

        // 무기 아이템 - 이미 소유한 무기는 표시
        if (weaponType && gameState.ownedWeapons.includes(weaponType)) {
            item.classList.add('owned');
            buyButton.disabled = true;
            buyButton.textContent = '소유함';
        }

        buyButton.addEventListener('click', () => {
            // 무기 구매
            if (weaponType) {
                if (gameState.ownedWeapons.includes(weaponType)) {
                    showMessage('이미 소유한 무기입니다');
                    return;
                }

                if (gameState.money >= price) {
                    gameState.money -= price;
                    saveMoney(gameState.money);
                    gameState.ownedWeapons.push(weaponType);
                    gameState.currentWeapon = weaponType;
                    item.classList.add('owned');
                    buyButton.disabled = true;
                    buyButton.textContent = '소유함';
                    updateUI();
                    showMessage(`${weapons[weaponType].name} 구매 완료!`);
                    updateShopUI();
                } else {
                    showMessage('돈이 부족합니다');
                }
            }
            // 탄약 구매
            else if (itemType === 'ammo' && ammoType) {
                if (!gameState.ownedWeapons.includes(ammoType)) {
                    showMessage('해당 무기를 먼저 구매하세요');
                    return;
                }

                if (gameState.money >= price) {
                    gameState.money -= price;
                    saveMoney(gameState.money);

                    // 탄약 추가
                    const ammoAmount = {
                        assault: 30,
                        pistol: 12,
                        revolver: 6,
                        autopistol: 15,
                        crossbow: 5,
                        sniper: 5
                    };

                    weapons[ammoType].reserveAmmo += ammoAmount[ammoType];
                    updateUI();
                    showMessage(`탄약 구매 완료! +${ammoAmount[ammoType]}발`);
                } else {
                    showMessage('돈이 부족합니다');
                }
            }
            // 포션 구매
            else if (itemType === 'potion' && potionType) {
                if (gameState.money >= price) {
                    gameState.money -= price;
                    saveMoney(gameState.money);

                    if (potionType === 'health') {
                        // 체력 회복
                        const oldHealth = gameState.health;
                        gameState.health = Math.min(gameState.maxHealth, gameState.health + 50);
                        const recovered = gameState.health - oldHealth;
                        updateUI();
                        showMessage(`체력 포션 사용! +${recovered} HP`);
                    } else if (potionType === 'speed') {
                        // 이동 속도 증가
                        gameState.speedMultiplier += 0.1;
                        showMessage(`스피드 포션 사용! 속도 +10%`);
                    }
                } else {
                    showMessage('돈이 부족합니다');
                }
            }
        });
    });

    document.getElementById('close-shop').addEventListener('click', () => {
        toggleShop();
    });
}

function toggleShop() {
    const shop = document.getElementById('weapon-shop');
    const isHidden = shop.classList.contains('hidden');

    if (isHidden) {
        // 상점 열기
        shop.classList.remove('hidden');
        document.exitPointerLock();
        gameState.isPaused = true; // 게임 일시정지
    } else {
        // 상점 닫기
        shop.classList.add('hidden');
        gameState.isPaused = false; // 게임 재개
        if (gameState.isGameStarted && !gameState.isGameOver) {
            document.body.requestPointerLock();
        }
    }
}

// 설정 메뉴 토글
function toggleSettings() {
    const settingsMenu = document.getElementById('settings-menu');
    const isHidden = settingsMenu.classList.contains('hidden');

    if (isHidden) {
        // 설정 메뉴 열기
        settingsMenu.classList.remove('hidden');
        document.exitPointerLock();
        gameState.isPaused = true; // 게임 일시정지

        // 첫 번째 아이템 선택
        currentSelectedItem = 0;
        updateSelectedItem();
    } else {
        // 설정 메뉴 닫기
        settingsMenu.classList.add('hidden');
        gameState.isPaused = false; // 게임 재개
        if (gameState.isGameStarted && !gameState.isGameOver) {
            document.body.requestPointerLock();
        }
    }
}

// 설정 메뉴 키보드 처리
let currentSelectedItem = 0;

function handleSettingsMenuKeys(e) {
    const settingsMenu = document.getElementById('settings-menu');

    // Q키로 닫기
    if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        toggleSettings();
        return;
    }

    // 현재 활성 탭 확인
    const activeTab = document.querySelector('.settings-tab.active').dataset.tab;

    // 좌우 방향키로 탭 전환
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const tabs = document.querySelectorAll('.settings-tab');
        const currentIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
        const newIndex = e.key === 'ArrowLeft' ? 0 : 1;

        if (newIndex !== currentIndex) {
            tabs[newIndex].click();
            currentSelectedItem = 0;
            updateSelectedItem();
        }
        return;
    }

    // 아이템 구매 탭에서만 상하 방향키 및 Enter 처리
    if (activeTab === 'shop') {
        const items = document.querySelectorAll('#shop-tab .shop-item');

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentSelectedItem = Math.max(0, currentSelectedItem - 1);
            updateSelectedItem();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentSelectedItem = Math.min(items.length - 1, currentSelectedItem + 1);
            updateSelectedItem();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // 선택된 아이템 구매
            const selectedItem = items[currentSelectedItem];
            const buyButton = selectedItem.querySelector('.buy-button');
            if (buyButton && !buyButton.disabled) {
                buyButton.click();
            }
        }
    }
}

// 선택된 아이템 하이라이트
function updateSelectedItem() {
    const activeTab = document.querySelector('.settings-tab.active').dataset.tab;

    if (activeTab === 'shop') {
        const items = document.querySelectorAll('#shop-tab .shop-item');
        items.forEach((item, index) => {
            if (index === currentSelectedItem) {
                item.style.border = '3px solid #4CAF50';
                item.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
            } else {
                item.style.border = '2px solid #555';
                item.style.boxShadow = 'none';
            }
        });
    }
}

// 설정 메뉴 설정
function setupSettings() {
    // 설정 버튼 클릭
    document.getElementById('settings-button').addEventListener('click', () => {
        toggleSettings();
    });

    // 닫기 버튼 클릭
    document.getElementById('close-settings').addEventListener('click', () => {
        toggleSettings();
    });

    // 탭 전환
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // 모든 탭 비활성화
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-content').forEach(content => {
                content.classList.add('hidden');
            });

            // 선택한 탭 활성화
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.remove('hidden');
        });
    });

    // 설정 메뉴 내 상점 아이템 구매 기능
    const settingsShopItems = document.querySelectorAll('#shop-tab .shop-item');
    settingsShopItems.forEach(item => {
        const itemType = item.dataset.type;
        const weaponType = item.dataset.weapon;
        const ammoType = item.dataset.ammo;
        const potionType = item.dataset.potion;
        const price = parseInt(item.dataset.price);
        const buyButton = item.querySelector('.buy-button');

        // 무기 아이템 - 이미 소유한 무기는 표시
        if (weaponType && gameState.ownedWeapons.includes(weaponType)) {
            item.classList.add('owned');
            buyButton.disabled = true;
            buyButton.textContent = '소유함';
        }

        buyButton.addEventListener('click', () => {
            // 무기 구매
            if (weaponType) {
                if (gameState.ownedWeapons.includes(weaponType)) {
                    showMessage('이미 소유한 무기입니다');
                    return;
                }

                if (gameState.money >= price) {
                    gameState.money -= price;
                    saveMoney(gameState.money);
                    gameState.ownedWeapons.push(weaponType);
                    gameState.currentWeapon = weaponType;
                    item.classList.add('owned');
                    buyButton.disabled = true;
                    buyButton.textContent = '소유함';
                    updateUI();
                    showMessage(`${weapons[weaponType].name} 구매 완료!`);
                    updateShopUI();
                } else {
                    showMessage('돈이 부족합니다');
                }
            }
            // 탄약 구매
            else if (itemType === 'ammo' && ammoType) {
                if (!gameState.ownedWeapons.includes(ammoType)) {
                    showMessage('해당 무기를 먼저 구매하세요');
                    return;
                }

                if (gameState.money >= price) {
                    gameState.money -= price;
                    saveMoney(gameState.money);

                    // 탄약 추가
                    const ammoAmount = {
                        assault: 30,
                        pistol: 12,
                        revolver: 6,
                        autopistol: 15,
                        crossbow: 5,
                        sniper: 5
                    };

                    weapons[ammoType].reserveAmmo += ammoAmount[ammoType];
                    updateUI();
                    showMessage(`탄약 구매 완료! +${ammoAmount[ammoType]}발`);
                } else {
                    showMessage('돈이 부족합니다');
                }
            }
            // 포션 구매
            else if (itemType === 'potion' && potionType) {
                if (gameState.money >= price) {
                    gameState.money -= price;
                    saveMoney(gameState.money);

                    if (potionType === 'health') {
                        // 체력 회복
                        const oldHealth = gameState.health;
                        gameState.health = Math.min(gameState.maxHealth, gameState.health + 50);
                        const recovered = gameState.health - oldHealth;
                        updateUI();
                        showMessage(`체력 포션 사용! +${recovered} HP`);
                    } else if (potionType === 'speed') {
                        // 이동 속도 증가
                        gameState.speedMultiplier += 0.1;
                        showMessage(`스피드 포션 사용! 속도 +10%`);
                    }
                } else {
                    showMessage('돈이 부족합니다');
                }
            }
        });
    });
}

// 상점 UI 업데이트 (양쪽 상점 동기화)
function updateShopUI() {
    const allShopItems = document.querySelectorAll('.shop-item');
    allShopItems.forEach(item => {
        const weaponType = item.dataset.weapon;
        const buyButton = item.querySelector('.buy-button');

        if (gameState.ownedWeapons.includes(weaponType)) {
            item.classList.add('owned');
            buyButton.disabled = true;
            buyButton.textContent = '소유함';
        }
    });
}

// UI 업데이트
function updateUI() {
    const weapon = weapons[gameState.currentWeapon];

    // 체력
    const healthPercent = Math.max(0, (gameState.health / gameState.maxHealth) * 100);
    document.getElementById('health-fill').style.width = healthPercent + '%';
    document.getElementById('health-text').textContent =
        `${Math.max(0, Math.round(gameState.health))} / ${gameState.maxHealth}`;

    // 탄약
    if (weapon.type === 'melee') {
        document.getElementById('current-ammo').textContent = '∞';
        document.getElementById('reserve-ammo').textContent = '';
        document.getElementById('ammo-separator').textContent = '';
    } else {
        document.getElementById('current-ammo').textContent = weapon.currentAmmo;
        document.getElementById('reserve-ammo').textContent = weapon.reserveAmmo;
        document.getElementById('ammo-separator').textContent = '/';
    }

    // 무기 이름
    document.getElementById('weapon-name').textContent = weapon.name;

    // 돈
    document.getElementById('money-amount').textContent = gameState.money;
}

// 플레이어 이동
function updatePlayer(deltaTime) {
    if (gameState.isGameOver || !gameState.isGameStarted || gameState.isPaused) return;

    // 중력 적용
    if (!player.onGround) {
        playerVelocity.y += GRAVITY;
    }

    // 이동 입력 처리
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    // 카메라 방향 기준으로 전후좌우 벡터 계산
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();

    const moveVector = new THREE.Vector3();

    if (keys['w'] || keys['W'] || keys['ArrowUp']) moveVector.add(forward);
    if (keys['s'] || keys['S'] || keys['ArrowDown']) moveVector.sub(forward);
    if (keys['d'] || keys['D'] || keys['ArrowRight']) moveVector.add(right);
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) moveVector.sub(right);

    if (moveVector.length() > 0) {
        moveVector.normalize();
        playerVelocity.x = moveVector.x * MOVE_SPEED * gameState.speedMultiplier;
        playerVelocity.z = moveVector.z * MOVE_SPEED * gameState.speedMultiplier;
    } else {
        playerVelocity.x *= 0.85;
        playerVelocity.z *= 0.85;
    }

    // 점프
    if (keys[' '] && player.onGround) {
        playerVelocity.y = JUMP_FORCE;
        player.onGround = false;
    }

    // 임시 위치 계산
    const newPosition = player.position.clone();
    newPosition.add(playerVelocity);

    // 충돌 검사
    player.onGround = false;

    for (let block of blocks) {
        const blockBox = new THREE.Box3().setFromObject(block);

        // Y축 충돌 검사 (바닥) - 이전 X, Z 위치 기준으로 체크
        if (playerVelocity.y <= 0) {
            const feetY = newPosition.y - PLAYER_HEIGHT;
            const playerBoxY = new THREE.Box3(
                new THREE.Vector3(
                    player.position.x - PLAYER_RADIUS,  // 이전 X 위치
                    newPosition.y - PLAYER_HEIGHT,
                    player.position.z - PLAYER_RADIUS   // 이전 Z 위치
                ),
                new THREE.Vector3(
                    player.position.x + PLAYER_RADIUS,  // 이전 X 위치
                    newPosition.y,
                    player.position.z + PLAYER_RADIUS   // 이전 Z 위치
                )
            );

            if (blockBox.intersectsBox(playerBoxY)) {
                if (feetY <= blockBox.max.y + 0.1 && feetY > blockBox.min.y - 0.5) {
                    newPosition.y = blockBox.max.y + PLAYER_HEIGHT;
                    playerVelocity.y = 0;
                    player.onGround = true;
                }
            }
        }

        // Y축 충돌 검사 (천장)
        if (playerVelocity.y > 0) {
            const headY = newPosition.y;
            const playerBoxY = new THREE.Box3(
                new THREE.Vector3(
                    newPosition.x - PLAYER_RADIUS,
                    newPosition.y - PLAYER_HEIGHT,
                    newPosition.z - PLAYER_RADIUS
                ),
                new THREE.Vector3(
                    newPosition.x + PLAYER_RADIUS,
                    newPosition.y + 0.1,
                    newPosition.z + PLAYER_RADIUS
                )
            );

            if (blockBox.intersectsBox(playerBoxY) && headY > blockBox.min.y && headY < blockBox.max.y) {
                newPosition.y = blockBox.min.y - 0.1;
                playerVelocity.y = 0;
            }
        }

        // X축, Z축 충돌 (벽과 장애물 체크)
        const playerBottom = newPosition.y - PLAYER_HEIGHT;
        const playerTop = newPosition.y;
        const blockTop = blockBox.max.y;
        const blockBottom = blockBox.min.y;

        // 블록이 플레이어와 수평으로 겹치는지 확인
        // 1. 바닥보다 높은 블록 (장애물/벽)
        // 2. 플레이어 발보다 높고, 플레이어 머리보다 낮은 블록
        const isObstacle = blockTop > playerBottom + 0.1;

        if (isObstacle) {
            const testBoxX = new THREE.Box3(
                new THREE.Vector3(
                    newPosition.x - PLAYER_RADIUS,
                    playerBottom,
                    newPosition.z - PLAYER_RADIUS
                ),
                new THREE.Vector3(
                    newPosition.x + PLAYER_RADIUS,
                    playerTop,
                    newPosition.z + PLAYER_RADIUS
                )
            );

            if (blockBox.intersectsBox(testBoxX)) {
                // 블록이 플레이어 발목보다 높으면 이동 차단 (계단 오르기 방지)
                const stepHeight = blockTop - playerBottom;
                if (stepHeight > 0.3) {  // 0.3 이상 높으면 점프 필요
                    newPosition.x = player.position.x;
                }
            }

            // Z축 충돌
            const testBoxZ = new THREE.Box3(
                new THREE.Vector3(
                    newPosition.x - PLAYER_RADIUS,
                    playerBottom,
                    newPosition.z - PLAYER_RADIUS
                ),
                new THREE.Vector3(
                    newPosition.x + PLAYER_RADIUS,
                    playerTop,
                    newPosition.z + PLAYER_RADIUS
                )
            );

            if (blockBox.intersectsBox(testBoxZ)) {
                // 블록이 플레이어 발목보다 높으면 이동 차단 (계단 오르기 방지)
                const stepHeight = blockTop - playerBottom;
                if (stepHeight > 0.3) {  // 0.3 이상 높으면 점프 필요
                    newPosition.z = player.position.z;
                }
            }
        }
    }

    // 위치 업데이트
    player.position.copy(newPosition);

    // 맵 경계 제한
    player.position.x = Math.max(-29, Math.min(29, player.position.x));
    player.position.z = Math.max(-29, Math.min(29, player.position.z));

    // 카메라 업데이트
    camera.position.copy(player.position);
    camera.rotation.set(player.rotation.x, player.rotation.y, 0);
}

// 창 크기 변경
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);

    if (!gameState.isGameOver) {
        const deltaTime = clock.getDelta();

        updatePlayer(deltaTime);
        updateZombies(deltaTime);
        updateGrenades(deltaTime);

        renderer.render(scene, camera);
    }
}

// 우클릭 메뉴 비활성화
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 게임 시작
init();
