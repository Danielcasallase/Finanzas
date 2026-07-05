# Raíz — Finanzas personales

App de finanzas personales (React + Vite), con datos guardados en Supabase
y accesible desde cualquier dispositivo a través de una URL propia en
GitHub Pages.

## Qué necesitas antes de empezar

- Una cuenta de [GitHub](https://github.com) (gratis).
- Una cuenta de [Supabase](https://supabase.com) (gratis, plan Free).
- Node.js instalado en tu computador **solo si quieres probarlo en local**
  antes de subirlo (no es obligatorio: puedes subir directo a GitHub y dejar
  que el deploy automático haga el resto).

---

## Paso 1 — Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Ponle un nombre (ej. `raiz`) y una contraseña de base de datos (guárdala,
   no la necesitarás para la app pero sí si entras por SQL directo).
3. Cuando el proyecto esté listo, ve a **SQL Editor** → **New query**.
4. Copia y pega el contenido del archivo `supabase/schema.sql` de este
   proyecto y dale **Run**. Esto crea la tabla `raiz_data` y las reglas de
   seguridad (cada usuario solo ve sus propios datos).
5. Ve a **Authentication → Providers** y confirma que **Email** esté
   habilitado (viene así por defecto). Este proyecto usa "enlace mágico"
   (magic link): entras con tu correo, sin contraseña.
6. Ve a **Authentication → URL Configuration** y en **Site URL** pon la URL
   final de tu sitio (la de GitHub Pages, ej.
   `https://tuusuario.github.io/raiz/`). Esto lo puedes ajustar después si
   aún no la tienes.
7. Ve a **Project Settings → API**. Ahí vas a encontrar dos datos que
   necesitas para el siguiente paso:
   - **Project URL** → va en `VITE_SUPABASE_URL`
   - **anon public key** → va en `VITE_SUPABASE_ANON_KEY`
   (Nunca copies la `service_role key` en este proyecto, esa es privada.)

---

## Paso 2 — Subir el código a GitHub

1. Crea un repositorio nuevo en GitHub (público o privado), por ejemplo
   llamado `raiz`.
2. Sube el contenido de esta carpeta al repo. Si usas la terminal:

   ```bash
   cd raiz-app
   git init
   git add .
   git commit -m "Primer commit de Raíz"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/raiz.git
   git push -u origin main
   ```

   Si prefieres no usar terminal, puedes arrastrar los archivos desde la
   web de GitHub ("Add file → Upload files").

3. Abre `vite.config.js` y confirma que `base: "/raiz/"` coincida con el
   nombre real de tu repositorio (si tu repo se llama distinto a `raiz`,
   cámbialo, ej. `base: "/mi-repo/"`).

---

## Paso 3 — Configurar los secretos del repo

1. En GitHub, entra al repo → **Settings → Secrets and variables →
   Actions → New repository secret**.
2. Crea dos secretos:
   - `VITE_SUPABASE_URL` → pega el Project URL de Supabase.
   - `VITE_SUPABASE_ANON_KEY` → pega el anon public key de Supabase.

Estos secretos los usa el flujo de despliegue automático
(`.github/workflows/deploy.yml`) para construir la app con tus credenciales
sin que queden escritas directamente en el código.

> Nota: la anon key sí queda visible dentro del código ya construido (es
> pública por diseño de Supabase). Lo que te protege son las políticas de
> seguridad (RLS) del Paso 1, que hacen que cada usuario solo pueda leer y
> escribir su propia fila.

---

## Paso 4 — Activar GitHub Pages

1. En el repo, ve a **Settings → Pages**.
2. En **Source**, elige **GitHub Actions** (no "Deploy from a branch").
3. Listo. Cada vez que hagas `git push` a `main`, el workflow construye el
   proyecto y lo publica solo.
4. La primera vez, ve a la pestaña **Actions** del repo para ver el
   progreso. Cuando termine en verde, tu sitio queda en:
   `https://TU_USUARIO.github.io/raiz/`

---

## Paso 5 — Usarlo

1. Abre la URL desde cualquier dispositivo.
2. Escribe tu correo → te llega un enlace de acceso → clic → ya estás
   dentro.
3. Todo lo que registres (cuentas, movimientos, presupuestos, metas) se
   guarda en Supabase y se sincroniza automáticamente entre dispositivos,
   siempre que entres con el mismo correo.

---

## Probarlo en tu computador antes de subirlo (opcional)

```bash
cd raiz-app
cp .env.example .env       # y edita .env con tus datos reales de Supabase
npm install
npm run dev
```

Abre la URL que te muestre la terminal (normalmente `http://localhost:5173`).

---

## Estructura del proyecto

```
raiz-app/
├── src/
│   ├── App.jsx           # La app completa (dashboard, movimientos, cuentas, metas, reportes)
│   ├── Auth.jsx           # Pantalla de login (enlace mágico por correo)
│   ├── supabaseClient.js  # Conexión a Supabase
│   ├── main.jsx           # Punto de entrada de React
│   └── index.css          # Tailwind
├── supabase/schema.sql    # Tabla y reglas de seguridad para pegar en Supabase
├── .github/workflows/deploy.yml  # Publica automáticamente en GitHub Pages
├── vite.config.js
└── package.json
```

## Ideas para más adelante

- Cambiar la tabla única `raiz_data` (todo en un JSON) por tablas separadas
  (`cuentas`, `movimientos`, `presupuestos`, `metas`) si en algún momento
  quieres hacer reportes con SQL directo o compartir datos entre usuarios.
- Dominio propio en vez de `github.io` (se configura en Settings → Pages →
  Custom domain).
- PWA (para "instalar" la app en el celular con un ícono, sin ser una app
  de tienda de aplicaciones).
