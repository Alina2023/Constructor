// ссылка на блок веб-страницы, в котором будет отображаться графика
var container;

// переменные: камера, сцена, отрисовщик и интерфейс
var camera, scene, renderer, gui;

// экранные координаты курсора мыши
var mouse = { x: 0, y: 0 };

// режим создания
var creator = false

//для курсора
var cylinder, circle, radius;

// создание загрузчика текстур
var loader = new THREE.TextureLoader();

// массив для объектов, проверяемых на пересечение с курсором
var targetList = [];
var terrain;

// глобальная переменная для хранения карты высот
var imagedata;
var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');
var img = new Image();

// загрузка изображения с картой высот
img.src = 'pics/plateau.jpg';

// загрузка модели дома
loadModel('', 'models/Дом/Cyprys_House.obj', 'models/Дом/Cyprys_House.mtl');
loadModel('', 'models/Деревья/Дерево/Tree.obj', 'models/Деревья/Дерево/Tree.mtl');

// массив моделей отображаемых в сцене
var initModels = []
var models = []
var curModel = -1 // выбранная модель
var drag = false // перемещение модели

// в этой функции можно добавлять объекты и выполнять их первичную настройку
function init() 
{
    // получение ссылки на блок html-страницы
    container = document.getElementById('container');
    // создание сцены
    scene = new THREE.Scene();

    // установка параметров камеры
    // 45 - угол обзора
    // window.innerWidth / window.innerHeight - соотношение сторон
    // 1 и 4000 - ближняя и дальняя плоскости отсечения
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);    

    // установка позиции камеры
    camera.position.set(60, 30, 60);
    
    // установка точки, на которую камера будет смотреть
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // создание отрисовщика
    renderer = new THREE.WebGLRenderer( { antialias: false } );
    renderer.setSize(window.innerWidth, window.innerHeight);
    
	// закрашивание экрана синим цветом, заданным в шестнадцатеричной системе
    renderer.setClearColor(new THREE.Color(0.5, 0.5, 0.5), 1);

    // реакция на взаимодействие с мышью
    renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
    renderer.domElement.addEventListener('mouseup', onDocumentMouseUp, false);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('wheel', onDocumentMouseScroll, false);
    renderer.domElement.addEventListener("contextmenu", function (event) {
        event.preventDefault();
    });
    container.appendChild(renderer.domElement);

    // добавление обработчика события изменения размеров окна
    window.addEventListener('resize', onWindowResize, false);

    //кисть
    createCursor();

    //интерфейс
    initGUI();
}

// определение пересечения
function intersect(x, y) {

    // получение экранных координат курсора мыши и приведение их к трёхмерным
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    // создание луча, исходящего из позиции камеры и проходящего сквозь позицию курсора мыши
    var vector = new THREE.Vector3(mouse.x, mouse.y, 1);
    vector.unproject(camera);
    var ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

    // создание массива для хранения объектов, с которыми пересечётся луч 
    return ray.intersectObjects(targetList, true);
}

// обработчики
// колесико мыши
function onDocumentMouseScroll(event) {

    //меняем радиус кисти
    if(!creator) {
        let wh = event.wheelDelta
        if(wh > 0) {
            radius += 1
        }
        else if(radius > 1) {
            radius -= 1
        }
        circle.scale.set(radius, radius, radius)
    }
}

//двигаем цилиндр и круг
function move(x, y) {
    let inter = intersect(x, y)
    if(inter.length > 0) {
        let p = inter[0].point
        cylinder.position.set(p.x, p.y + 3, p.z)
        circle.position.set(p.x, p.y + 1, p.z)
    }
}

// двигаем мышью
function onDocumentMouseMove(event) {

    // координаты мыши на экране
    let x = event.clientX
    let y = event.clientY

    // получение экранных координат курсора мыши и приведение их к трёхмерным
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;
    if(!creator) {
        
        //смещаем кисть
        move(x, y)
    }
    else if(drag && curModel != -1) {
        
        //смещаем выбранную модель
        models[curModel].position.set(mouse.x * 50, 5, -mouse.y * 50)
    }
}

// нажали кнопку
function onDocumentMouseDown(event) {

    // координаты мыши на экране
    let x = event.clientX
    let y = event.clientY
    
    // изменяем ландшафт
    if(!creator) {
        move(x, y)
        let inter = intersect(x, y)
        if(inter.length > 0) {

            // изменяем поверхность (поднимаем)
            let p0 = inter[0].point
            let r = radius;
            
            //по каждой вершине
            let geometry = terrain.geometry
            for(let i = 0; i < geometry.vertices.length; i++) {
                
                // получение позиции в локальной системе координат
                var pos = new THREE.Vector3();
                pos.copy(geometry.vertices[i]);
                
                // нахождение позиции в глобальной системе координат
                pos.applyMatrix4(terrain.matrixWorld);

                //в круге
                let d = pos.distanceTo(p0)
                if(d < r) {
                    let h = Math.sqrt(r * r - d * d)
                    geometry.vertices[i].y += h
                }
            }

            // считаем нормали
            geometry.computeFaceNormals();
            geometry.computeVertexNormals();
            geometry.verticesNeedUpdate = true; //обновление вершин
            geometry.normalsNeedUpdate = true; //обновление нормалей
        }
    }
    else {
        
        // выбор другого объекта сцены
        let inter = intersect(x, y)
        let idx = -1
        for(let i = 0; i < inter.length && idx == -1; i++) {
            for(let j = 0; j < targetList.length && idx == -1; j++) {

                // нашли объект
                if(targetList[j] == inter[i].object.parent) {
                    idx = j - 1
                }
            }
        }
        curModel = idx
        drag = true
    }
}

// отпустили кнопку
function onDocumentMouseUp(event) {
    drag = false
}

function onWindowResize()
{
    // изменение соотношения сторон для виртуальной камеры
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
	// изменение соотношения сторон рендера
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// в этой функции можно изменять параметры объектов и обрабатывать действия пользователя
function animate() 
{
    // добавление функции на вызов при перерисовке браузером страницы 
    requestAnimationFrame(animate);
    render();
}

function render() 
{
    // рисование кадра
    renderer.render(scene, camera);
}

// загрузка изображения
img.onload = function()
{
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);
    imagedata = context.getImageData(0, 0, img.width, img.height);

    // пользовательская функция генерации ландшафта
    createTerrain();

    // сфера
    createStars();

    // свет
    createLight();
}

// функция генерации ландшафта (лр1)
function createTerrain() {
    let N = 256
    let mas = new THREE.Geometry();
    for (var j = 0; j < N; j++)
        for (var i = 0; i < N; i++) {
            let pos = (i + imagedata.width * j) * 4;
            mas.vertices.push(new THREE.Vector3(i, imagedata.data[pos] / 8, j));
        }
    for (var i = 0; i < N - 1; i++)
        for (var j = 0; j < N - 1; j++) {
            mas.faces.push(new THREE.Face3((i * N) + j, (i * N) + (j + 1), (i + 1) * N + j));
            mas.faces.push(new THREE.Face3((i * N) + (j + 1), (i + 1) * N + (j + 1), (i + 1) * N + j));
            mas.faceVertexUvs[0].push([new THREE.Vector2(j/N, i/N),
                            new THREE.Vector2((j+1)/N, (i)/N),
                            new THREE.Vector2((j)/N, (i+1)/N)]);
            mas.faceVertexUvs[0].push([new THREE.Vector2((j+1)/N, (i)/N),
                            new THREE.Vector2((j+1)/N, (i+1)/N),
                            new THREE.Vector2((j)/N, (i+1)/N)]);
        }

    // считаем нормали
    mas.computeFaceNormals();
    mas.computeVertexNormals();

    // загрузка текстуры
    let tex = new THREE.TextureLoader().load('pics/grasstile.jpg');
    
    // Создание матерьяла, параметрами указано что отрисовщику следует использовать
    // цвета из вершин, а так же отрисовывать обе стороны треугольника
    let terrainMaterial = new THREE.MeshLambertMaterial({
        map:tex,
        //vertexColors: THREE.VertexColors,
        side:THREE.DoubleSide
    });
    
    // Создание объекта и установка его в определённую позицию
    terrain = new THREE.Mesh(mas, terrainMaterial);
    terrain.scale.set(0.16, 0.16, 0.16)
    terrain.position.set(-10, 0.0, -10);
    targetList.push(terrain);
    scene.add(terrain);
}

// звездное небо
function createStars() {

    // создание геометрии для сферы	
    var geometry = new THREE.SphereGeometry(120, 32, 32);

    // загрузка текстуры
    var tex = loader.load("pics/sky.jpg");

    // создание материала
    var material = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide
    });

    // создание объекта
    var sphere = new THREE.Mesh(geometry, material);
    sphere.position.z += 20
    sphere.position.x -= 20

    // размещение объекта в сцене
    scene.add(sphere);
}

// свет
function createLight() {
	
	// создание точечного источника освещения заданного цвета
	var spotlight = new THREE.PointLight(new THREE.Color(1, 1, 1));

	// установка позиции источника освещения
	spotlight.position.set(60, 60, 60);

	// добавление источника в сцену
	scene.add(spotlight);
}

// функция загрузки модели из файла
function loadModel(path, objName, mtlName)
{
    // функция, выполняемая в процессе загрузки модели (выводит процент загрузки)
    var onProgress = function(xhr) {
        if (xhr.lengthComputable) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            console.log(Math.round(percentComplete, 2) + '% downloaded');
        }
    };
    
    // функция, выполняющая обработку ошибок, возникших в процессе загрузки
    var onError = function(xhr) { };

    var mtlLoader = new THREE.MTLLoader();
    mtlLoader.setPath(path);

    // функция загрузки материала
    mtlLoader.load(mtlName, function(materials)
    {
        materials.preload();
        var objLoader = new THREE.OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath(path);

        // функция загрузки модели
        objLoader.load(objName, function (object)
        {
            object.position.x = 0;
            object.position.y = 5;
            object.position.z = 0;
            object.scale.set(0.2, 0.2, 0.2);
            initModels.push(object)
        }, onProgress, onError);
    });
}

// кисть
function createCursor() {

    // параметры цилиндра: диаметр вершины, диаметр основания, высота, число сегментов
    var cylinderGeometry = new THREE.CylinderGeometry(1.2, 0, 4, 64);
    var cylinderMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
    cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.position.set(5, 8, 5)
    scene.add(cylinder);

    // окружность
    var circleMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    radius = 1
    var segments = 120;
    var circleGeometry = new THREE.CircleGeometry(radius, segments);      

    // удаление центральной вершины      
    circleGeometry.vertices.shift();
    circle = new THREE.Line(circleGeometry, circleMaterial);
    circle.rotation.x = 3.14 / 2.0
    radius += 2
    circle.scale.set(radius, radius, radius)
    circle.position.set(5, 5, 5)
    scene.add(circle);
}

// функция добавления дома
function addHouse() {
    models.push(initModels[1].clone())
    targetList.push(models[models.length - 1])
    scene.add(models[models.length - 1])
    curModel = models.length - 1
}

// функция добавления дерева
function addTree() {
    models.push(initModels[0].clone())
    targetList.push(models[models.length - 1])
    scene.add(models[models.length - 1])
    curModel = models.length - 1
}

// функция удаления выбранного объекта
function deleteObject() {
    if(curModel != -1) {
        scene.remove(models[curModel])
        models.splice(curModel, 1)
        targetList.splice(curModel + 1, 1) // первая модель это ландшафт
        curModel = -1
    }
}

// инициализация GUI
function initGUI() {

    // объект интерфейса и его ширина  
    gui = new dat.GUI();
    gui.width = 200;

    // массив переменных, ассоциированных с интерфейсом  
    var params = 
    {
        sx: 0,
        sy: 0,
        sz: 0,
        rad: 0,
        brush: true,
        addHouse: function() { addHouse() },
        addTree: function() { addTree() },
        deleteObject: function() { deleteObject() }
    };

    // создание вкладки
    var folder1 = gui.addFolder('Scale');

    // ассоциирование переменных, отвечающих за масштабирование и поворот
    // в окне интерфейса они будут представлены в виде слайдеров
    // минимальное значение - 1, максимальное – 100, шаг – 1
    // listen означает, что изменение переменных будет отслеживаться
    var meshSX = folder1.add(params, 'sx').min(0.1).max(2).step(0.1).listen();
    var meshSY = folder1.add(params, 'sy').min(0.1).max(2).step(0.1).listen();
    var meshSZ = folder1.add(params, 'sz').min(0.1).max(2).step(0.1).listen();
    var angleR = folder1.add(params, 'rad').min(1).max(360).step(1).listen();

    // при запуске программы папка будет открыта
    folder1.open();

    // описание действий совершаемых при изменении ассоциированных значений  
    meshSX.onChange(function(value) {
        if(curModel != -1) {
            let y = models[curModel].scale.y
            let z = models[curModel].scale.z
            models[curModel].scale.set(value, y, z)
        }
    });

    meshSY.onChange(function(value) {
        if(curModel != -1) {
            let x = models[curModel].scale.x
            let z = models[curModel].scale.z
            models[curModel].scale.set(x, value, z)
        }
    });

    meshSZ.onChange(function(value) {
        if(curModel != -1) {
            let x = models[curModel].scale.x
            let y = models[curModel].scale.y
            models[curModel].scale.set(x, y, value)
        }
    });

    angleR.onChange(function(value) {
        if(curModel != -1) {
            let x = models[curModel].rotation.x
            let z = models[curModel].rotation.z
            models[curModel].rotation.set(x, value * 3.14 / 180, z)
        }
    });

    // добавление чекбокса с именем brush
    var brushVisible = gui.add(params, 'brush').name('brush').listen();
    brushVisible.onChange(function(value)
    {
        creator = !value
        if(creator) {
            cylinder.position.set(-100, 0, -100)
            circle.position.set(-100, 0, -100)
        }
    });

    // добавление кнопок
    gui.add(params, 'addHouse').name("add house");

    // для дерева
    gui.add(params, 'addTree').name("add tree");

    // для удаления выбранного объекта
    gui.add(params, 'deleteObject').name("delete object");
        
    // при запуске программы интерфейс будет раскрыт
    gui.open();
}

// функция инициализации камеры, отрисовщика, объектов сцены и т.д.
init();

// обновление данных по таймеру браузера
animate();