# Guía de Despliegue en Proxmox y Cloudflare Tunnel

Esta guía detalla el proceso paso a paso para alojar la web de **Agata Consultores** en su servidor Proxmox de forma gratuita, segura y resolviendo el problema de la IP dinámica utilizando un túnel de Cloudflare.

---

## Arquitectura Recomendada

```
[ Visitante Web ] ---> ( Cloudflare CDN / SSL ) 
                               |
                       ( Cloudflare Tunnel )   <--- Conexión de salida segura
                               |
                 [ Proxmox VE (Contenedor LXC) ]
                               |
                       [ Servidor Nginx ]
```

- **LXC Container**: Muy ligero, consume menos de 100MB de RAM.
- **Nginx**: Servidor web ultrarrápido para archivos estáticos.
- **Cloudflare Tunnel (`cloudflared`)**: Crea una conexión segura saliente desde su contenedor hacia la red de Cloudflare. Bypassa CGNAT, firewalls y no requiere abrir puertos en su router. Resuelve automáticamente las IPs dinámicas.

---

## Paso 1: Configurar el Dominio en Cloudflare

1. Cree una cuenta gratuita en [Cloudflare](https://www.cloudflare.com/).
2. Añada su sitio `agataconsultores.cl`.
3. Cloudflare le indicará dos servidores de nombres (Name Servers), por ejemplo:
   - `colin.ns.cloudflare.com`
   - `rosa.ns.cloudflare.com`
4. Vaya al proveedor donde compró su dominio (si es `.cl`, ingrese a [NIC Chile](https://www.nic.cl/)).
5. Modifique los servidores de nombre del dominio `agataconsultores.cl` y reemplace los actuales por los provistos por Cloudflare.
6. Espere unos minutos a que se complete la propagación DNS.

---

## Paso 2: Crear el Contenedor LXC en Proxmox

1. Acceda a su interfaz de Proxmox VE.
2. Descargue la plantilla de **Debian 12** o **Ubuntu 22.04/24.04** desde la sección *Templates* de su almacenamiento local.
3. Haga clic en **Create CT** (esquina superior derecha):
   - **Hostname**: `agata-web`
   - **Password**: Defina su contraseña de root.
   - **Template**: Seleccione la plantilla descargada.
   - **Disk**: 8 GB es más que suficiente.
   - **CPU**: 1 vCPU.
   - **Memory**: 512 MB RAM / 512 MB Swap.
   - **Network**: Deje en DHCP o asigne una IP estática local (ej. `192.168.1.150/24`) y configure su Gateway de red.
4. Finalice y encienda el contenedor.

---

## Paso 3: Configurar Nginx y Cargar la Web

1. Abra la consola del contenedor LXC recién creado en Proxmox.
2. Actualice el sistema e instale Nginx:
   ```bash
   apt update && apt upgrade -y
   apt install nginx curl git -y
   ```
3. Cree la carpeta para la web:
   ```bash
   mkdir -p /var/www/agata-web
   ```
4. Copie los archivos de la web (`index.html`, `style.css` y `main.js`) a la ruta `/var/www/agata-web/`. Puede hacerlo mediante SCP, clonando un repositorio Git, o usando una herramienta de transferencia de archivos.
5. Configure Nginx para servir el sitio. Cree un nuevo archivo de configuración:
   ```bash
   nano /etc/nginx/sites-available/agata-web
   ```
6. Pegue la siguiente configuración (reemplace con sus datos):
   ```nginx
   server {
       listen 80;
       server_name agataconsultores.cl www.agataconsultores.cl;

       root /var/www/agata-web;
       index index.html;

       location / {
           try_files $uri $uri/ =404;
       }

       # Opciones de caché para optimizar velocidad
       location ~* \.(css|js|ico|webp|png|jpg|jpeg)$ {
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }
   }
   ```
7. Habilite el sitio y remueva la configuración por defecto de Nginx:
   ```bash
   ln -s /etc/nginx/sites-available/agata-web /etc/nginx/sites-enabled/
   rm /etc/nginx/sites-enabled/default
   ```
8. Pruebe que la configuración de Nginx no tenga errores sintácticos y reinicie el servicio:
   ```bash
   nginx -t
   systemctl restart nginx
   ```

---

## Paso 4: Crear y Configurar el Cloudflare Tunnel

1. En el panel de Cloudflare, navegue a **Zero Trust** (menú lateral izquierdo).
2. Diríjase a **Networks** > **Tunnels**.
3. Haga clic en **Add a tunnel** y seleccione **Cloudflare Tunnel (Connector)**.
4. Asigne un nombre descriptivo, por ejemplo: `agata-proxmox-lxc`, y guarde.
5. Cloudflare le mostrará los comandos para instalar el conector (`cloudflared`) según su sistema operativo. Seleccione **Debian** o **Ubuntu** (según lo elegido en el LXC) y la arquitectura **amd64**.
6. Copie el comando provisto que instala y arrastra el token. Se verá similar a esto (ejecútelo en la consola del contenedor):
   ```bash
   # 1. Descargar e instalar cloudflared
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   dpkg -i cloudflared.deb

   # 2. Configurar como servicio de sistema utilizando su Token único
   cloudflared service install <SU_TOKEN_DE_TÚNEL_PROVISTO_POR_CLOUDFLARE>
   ```
7. Regrese al panel de Cloudflare. Debería ver que el túnel figura en estado **Active** (Verde).
8. Haga clic en **Next** para ir a la pestaña **Route Traffic**.
9. Configure la ruta de tráfico para conectar su dominio a Nginx:
   - **Public Hostname**:
     - Subdomain: (deje vacío para el dominio raíz o escriba `www`)
     - Domain: seleccione `agataconsultores.cl`
   - **Service**:
     - Type: `HTTP`
     - URL: `localhost:80`
10. Guarde la configuración. Si desea que funcione tanto para `agataconsultores.cl` como para `www.agataconsultores.cl`, añada un segundo Hostname público en la configuración del túnel apuntando también a `localhost:80`.

*¡Listo! Cloudflare se encargará de enrutar el tráfico web seguro (HTTPS con certificado SSL automático y gratuito) directamente a su contenedor LXC, ignorando los cambios de su IP dinámica.*

---

## Paso 5: Activar el Formulario de Contacto (Formspree)

Para evitar programar un backend SMTP dentro del contenedor LXC (lo cual es complejo y los correos suelen caer en spam):

1. Regístrese gratuitamente en [Formspree](https://formspree.io/).
2. Cree un nuevo formulario ("New Form") y asígnele un nombre (ej. "Contacto Agata").
3. Vincule el formulario a su correo de destino: `agataconsultorescl@gmail.com`.
4. Formspree le proporcionará un endpoint ID, que se ve así: `https://formspree.io/f/xbjdnzlk`
5. Abra el archivo `index.html` de su web y busque la línea del formulario:
   ```html
   <form action="https://formspree.io/f/agataconsultores" method="POST" class="minimal-form" id="contact-form">
   ```
6. Reemplace `https://formspree.io/f/agataconsultores` por su URL de Formspree real.
7. Guarde los cambios y pruébelo. Los envíos llegarán directamente a su Gmail de forma segura.
