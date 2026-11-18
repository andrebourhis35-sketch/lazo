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
window.geometry('640x515')
window.minsize(560, 480)
panel = ttk.Frame(window, padding=24)
panel.pack(fill='both', expand=True)
ttk.Label(panel, text='Activar correos de LAZO', font=('Segoe UI', 19, 'bold')).pack(anchor='w')
ttk.Label(panel, text='Recuperación de acceso e invitaciones para tu equipo.', wraplength=570).pack(anchor='w', pady=(7, 17))
ttk.Label(panel, text='Servidor SMTP indicado en tu cuenta Zoho').pack(anchor='w')
host = tk.StringVar(value='smtppro.zoho.com')
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
          'se guarda solo en el entorno privado de LAZO.', wraplength=570).pack(anchor='w', pady=(2, 13))
ttk.Label(panel, text='La comprobación usa TLS en el puerto 465. No envía ningún correo.', wraplength=570).pack(anchor='w')
status = tk.StringVar(value='Completa los datos y pulsa el botón.')
ttk.Label(panel, textvariable=status, wraplength=570).pack(anchor='w', pady=(14, 8))


def save():
    data = {'host': host.get(), 'port': 465, 'user': user.get().strip().lower(), 'password': password.get()}
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
                                    input=json.dumps(data).encode(), capture_output=True, timeout=120,
                                    creationflags=subprocess.CREATE_NO_WINDOW)
            ok = result.returncode == 0 and json.loads(result.stdout.decode()).get('ok') is True
        except Exception:
            ok = False
        (ROOT / 'mail-setup-status.json').write_text(json.dumps({'ok': ok}), encoding='utf-8')

        def finish():
            password.set('')
            button.configure(state='normal')
            if ok:
                status.set('Configuración comprobada y guardada. Ya puedes cerrar esta ventana.')
                messagebox.showinfo('Correo configurado', 'Zoho aceptó la conexión segura. '
                                    'Falta comprobar que el correo de recuperación llegue a tu bandeja.', parent=window)
            else:
                status.set('No se guardó. Revisa servidor, correo y contraseña de aplicación de Zoho.')
        window.after(0, finish)
    threading.Thread(target=submit, daemon=True).start()


button = ttk.Button(panel, text='Guardar y comprobar conexión segura', command=save)
button.pack(anchor='e', pady=(5, 0))
window.mainloop()
