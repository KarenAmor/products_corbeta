# Proyecto de Gestión de Productos

Este es un proyecto backend desarrollado con **NestJS** que implementa un módulo de gestión de productos utilizando una base de datos **MySQL**, **TypeORM** como ORM, y **Nodemailer** para el envío de notificaciones por correo electrónico. Incluye un CRUD completo para productos con funcionalidades avanzadas como paginación, búsqueda, carga masiva y un sistema de logs para registrar cambios. Además, se ha implementado autenticación basada en encabezados para proteger los endpoints del sistema.

## Tecnologías utilizadas

- **NestJS**: Framework principal para construir la API.
- **MySQL**: Base de datos relacional para almacenar los datos.
- **TypeORM**: ORM para interactuar con la base de datos.
- **Nodemailer**: Servicio para enviar correos electrónicos con notificaciones de errores.
- **Node.js**: Entorno de ejecución.
- **Swagger**: Documentación interactiva de la API.
- **Jest**: Framework para pruebas unitarias.

## Características

### Módulo de Autenticación
El sistema de autenticación se basa en el envío de credenciales a través de headers HTTP. No se utiliza JWT, sino que los endpoints protegidos requieren que el usuario envíe su correo electrónico y contraseña en los headers de la petición.

Validación de credenciales:

Los endpoints protegidos requieren los headers:
- **usuario**: Correo electrónico del usuario.
- **password**: Contraseña del usuario.

Un AuthGuard verifica la autenticidad del usuario antes de procesar la petición.

- En caso de credenciales inválidas o ausencia de las mismas, se devuelve un error 401 Unauthorized.

### Módulo de Productos
El módulo de productos ofrece las siguientes funcionalidades:

1. **CRUD Completo**:
   - **Listar todos los productos**: Obtiene los productos paginados (configurable por página y tamaño).
   - **Búsqueda por nombre**: Permite buscar productos filtrando por palabras en el campo `name`.
   - **Búsqueda por referencia**: Encuentra un producto específico usando su `reference`.
   - **Creación masiva**: Permite cargar múltiples productos al mismo tiempo sin interrumpir el flujo si hay errores (los registros válidos se guardan y los errores se notifican).
   - **Actualización**: Modifica un producto existente por su `reference`.
   - **Eliminación**: Elimina un producto por su `reference`.

2. **Manejo de Errores**:
   - Cuando ocurre un error en cualquier endpoint, se envía una notificación por correo electrónico con los detalles del problema.
   - En la carga masiva, los errores no detienen el proceso; los productos válidos se registran y los errores se reportan por email.

3. **Sistema de Logs**:
   - Registra automáticamente las operaciones en la tabla `products` (creación, modificación, eliminación).
   - Cada cambio genera un log con la información relevante (como la `reference`, el tipo de operación y los datos antes/después).

4. **Pruebas Unitarias**:
  Se han implementado pruebas unitarias con Jest para garantizar la calidad del código en los siguientes módulos:
    - Autenticación: Se prueba la validación de credenciales y la respuesta del guardián de autenticación.
    - Productos: Se validan las operaciones CRUD, así como las reglas de negocio y validaciones.

5. **Documentación de la API**:
  Se ha utilizado Swagger para generar la documentación interactiva de la API. Para acceder a la documentación, inicie el servidor y diríjase a:
    ```bash
    http://localhost:3000/api
    ```

Esta documentación detalla todos los endpoints disponibles, los formatos de peticiones y respuestas, así como ejemplos de uso.

## Requisitos previos

- **Node.js** (versión 16.x o superior).
- **MySQL** (versión 8.x o superior).
- **NPM** o **Yarn** como gestor de paquetes.
- Una cuenta de correo para configurar **Nodemailer** (por ejemplo, Gmail con una contraseña de aplicación).

## Instalación

1. **Clona el repositorio**:
   ```bash
   git clone <url-del-repositorio>
   cd <nombre-del-proyecto>
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Configura las variables de entorno**:
   - Copia el archivo `.env.example` a `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edita `.env` con tus valores reales:
    ```bash
     DB_HOST=tu_host_de_base_de_datos
     DB_PORT=puerto_de_base_de_datos
     DB_USERNAME=tu_usuario_de_base_de_datos
     DB_PASSWORD=tu_contraseña_de_base_de_datos
     DB_NAME=nombre_de_tu_base_de_datos
     DB_SYNCHRONIZE=true_o_false
    ```

4. **Inicializa la base de datos**:
   - Asegúrate de que MySQL esté corriendo.
   - Crea la base de datos especificada en `DB_DATABASE`.
   - TypeORM sincronizará las entidades automáticamente al iniciar la aplicación (si `synchronize: true` está configurado).

5. **Inicia la aplicación**:
    ```bash
    npm run start:dev
    ```
   - La API estará disponible en `http://localhost:3000` (o el puerto configurado).

## Uso

### Endpoints principales
Usa una herramienta como **Postman** o **cURL** para interactuar con la API. Aquí algunos ejemplos:

- **Listar productos paginados**:
  ```
  GET /products?page=1&limit=10
  ```

- **Buscar por nombre**:
  ```
  GET /products?keyword=teclado
  ```

- **Buscar por referencia**:
  ```
  GET /products/PROD001
  ```

- **Crear un producto**:
  ```
  POST /products
  {
    "reference": "PROD001",
    "name": "Teclado mecánico",
    "vat": 15.00,
    "isActive": true
  }
  ```

- **Carga masiva**:
  ```
  POST /products?batchSize=10
  [
    {"reference": "PROD002", "name": "Mouse", "vat": 5.00, "isActive": 1},
    {"reference": "PROD003", "name": "Monitor", "vat": 10.00, "isActive": true}
  ]
  ```

- **Actualizar un producto**:
  ```
  PATCH /products/PROD001
  {
    "name": "Teclado mecánico actualizado",
    "vat": 12.50
  }
  ```

- **Eliminar un producto**:
  ```
  DELETE /products/PROD001
  ```

### Respuesta en caso de errores
Si ocurre un error (por ejemplo, un `reference` duplicado en la carga masiva), recibirás un correo con detalles como:
```
Errores al crear productos en masa:
Producto con reference "PROD001": Reference duplicado
```

## Contribuir

1. Haz un fork del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`).
3. Commitea tus cambios (`git commit -m "Agrega nueva funcionalidad"`).
4. Sube tu rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un Pull Request.

## Licencia

[MIT]
