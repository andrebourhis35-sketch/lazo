"""Private, local credential handoff: input is sent only to the user's VPS over SSH."""
import json
from pathlib import Path
import subprocess
import threading
import tkinter as tk
from tkinter import ttk, messagebox

ROOT = Path.home() / 'AppData' / 'Local' / 'LAZOBackup'
config = json.loads((ROOT / 'config.json').read_text(encoding='utf-8-sig'))
window = tk.Tk()
window.title('LAZO · Correo privado de Zoho')
window.geometry('680x600')
window.minsize(620, 580)
panel = ttk.Frame(window, padding=24)
panel.pack(fill='both', expand=True)
ttk.Label(panel, text='Activar correos de LAZO', font=('Segoe UI', 19, 'bold')).pack(anchor='w')
ttk.Label(panel, text='Recuperación de acceso e invitaciones para tu equipo.', wraplength=570).pack(anchor='w', pady=(7, 17))
ttk.Label(panel, text='Servidor SMTP indicado en tu cuenta Zoho').pack(anchor='w')
host = tk.StringVar(value='smtp.zoho.com')
ttk.Combobox(panel, textvariable=host, state='readonly', values=(
    'smtppro.zoho.com','smtp.zoho.com','smtppro.zoho.eu','smtp.zoho.eu',
    'smtppro.zoho.in','smtp.zoho.in','smtppro.zoho.com.au','smtp.zoho.com.au')).pack(fill='x', pady=(5, 12))
ttk.Label(panel, text='Correo de Zoho que enviará los mensajes').pack(anchor='w')
user = tk.StringVar(value='contacto@espacio-sereno.com')
ttk.Entry(panel, textvariable=user).pack(fill='x', pady=(5, 12))
ttk.Label(panel, text='Contraseña de aplicación de Zoho (secreta)').pack(anchor='w')
password = tk.StringVar()
ttk.Entry(panel, textvariable=password, show='●').pack(fill='x', pady=(5, 12))
ttk.Label(panel, text='Usa una contraseña de aplicación creada en la seguridad de tu cuenta Zoho. '
          'No la envíes por chat. Se transmite por SSH a tu VPS y se comprueba con Zoho; '
          'se guarda solo en el entorno privado de LAZO. Los espacios de separación '
          'de la contraseña se eliminan al guardar.', wraplength=570).pack(anchor='w', pady=(2, 13))
ttk.Label(panel, text='La comprobación usa TLS en el puerto 465. No envía ningún correo.', wraplength=570).pack(anchor='w')
status = tk.StringVar(value='Completa los datos y pulsa el botón.')
ttk.Label(panel, textvariable=status, wraplength=570).pack(anchor='w', pady=(14, 8))

ERRORS = {
    'smtp-settings': 'Revisa el servidor SMTP, el correo y que hayas pegado solo la contraseña de aplicación de Zoho.',
    'smtp-auth': 'Zoho rechazó el acceso. Comprueba que la contraseña de aplicación pertenezca al correo indicado y que la cuenta permita SMTP.',
    'smtp-tls': 'No se pudo validar la conexión cifrada de Zoho. Pide revisar el certificado; no desactives TLS.',
    'smtp-connection': 'El servidor no pudo completar la conexión con Zoho. Revisa la disponibilidad del servicio antes de reintentar.',
    'smtp-temporary': 'Zoho indicó un fallo temporal. Espera antes de volver a guardar.',
    'smtp-check': 'El verificador de Zoho no pudo completar la comprobación. Codex puede revisar este código sin tu contraseña.',
    'ssh-connection': 'No se pudo conectar con tu VPS. Comprueba la conexión a Internet y avisa a Codex.',
    'server-response': 'El VPS no devolvió un resultado válido. Codex puede revisar el configurador sin tu contraseña.',
    'server-permissions': 'El configurador no tiene los permisos privados esperados. Codex debe revisarlos.',
    'server-restart': 'LAZO no inició con el nuevo correo. Se restauró el entorno anterior; Codex debe comprobar el servicio.',
    'server-recovery': 'No se pudo confirmar la recuperación del servicio. No reintentes; pide a Codex comprobar el servidor.',
    'server-setup': 'No se pudo completar el guardado privado del servidor. Codex debe revisarlo.',
    'setup-timeout': 'La comprobación superó el tiempo de espera. El resultado es incierto; Codex debe revisar el servidor antes de reintentar.'
}


def save():
    data = {'host': host.get(), 'port': 465, 'user': user.get().strip().lower(), 'password': password.get().replace(' ', '')}
    if not data['user'] or not data['password']:
        messagebox.showwarning('Faltan datos', 'Completa el correo y la contraseña de aplicación.', parent=window)
        return
    button.configure(state='disabled')
    status.set('Comprobando Zoho y guardando en el servidor…')

    def submit():
        options = ['-o','BatchMode=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=yes',
                   '-o','UserKnownHostsFile=' + config['knownHosts'],'-i',config['sshKey']]
        try:
            result = subprocess.run([config['ssh'], *options, config['server'],
                                     'sudo -n /usr/local/sbin/lazo-crm-mail-configure'],
                                    input=json.dumps(data).encode(), capture_output=True, timeout=330,
                                    creationflags=subprocess.CREATE_NO_WINDOW)
            try:
                response = json.loads(result.stdout.decode())
            except (ValueError, UnicodeError):
                response = {}
            ok = result.returncode == 0 and isinstance(response, dict) and response.get('ok') is True
            code = response.get('error') if isinstance(response, dict) else None
            if not isinstance(code, str) or code not in ERRORS:
                code = 'ssh-connection' if result.returncode == 255 else ('setup-timeout' if result.returncode == 124 else 'server-response')
        except subprocess.TimeoutExpired:
            ok, code = False, 'setup-timeout'
        except Exception:
            ok, code = False, 'ssh-connection'
        data['password'] = ''
        (ROOT / 'mail-setup-status.json').write_text(json.dumps({'ok': ok, 'code': 'ok' if ok else code}), encoding='utf-8')

        def finish():
            password.set('')
            button.configure(state='normal')
            if ok:
                status.set('Configuración comprobada y guardada. Ya puedes cerrar esta ventana.')
                messagebox.showinfo('Correo configurado', 'Zoho aceptó la conexión segura. '
                                    'Falta comprobar que el correo de recuperación llegue a tu bandeja.', parent=window)
            else:
                status.set('No se pudo completar la configuración. Código: ' + code)
                messagebox.showerror('No se pudo configurar el correo', ERRORS[code] + '\n\nCódigo: ' + code, parent=window)
        window.after(0, finish)
    threading.Thread(target=submit, daemon=True).start()


button = ttk.Button(panel, text='Guardar y comprobar conexión segura', command=save)
button.pack(anchor='e', pady=(5, 0))
def close_window():
    if str(button['state']) == 'disabled':
        messagebox.showinfo('Comprobación en proceso', 'Espera a que termine la comprobación antes de cerrar.', parent=window)
    else:
        window.destroy()
window.protocol('WM_DELETE_WINDOW', close_window)
window.mainloop()
