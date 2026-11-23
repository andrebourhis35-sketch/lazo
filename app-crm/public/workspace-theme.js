export const themeKey='lazo.workspace.theme';

export function readWorkspaceTheme() {
  try{return localStorage.getItem(themeKey)==='light'?'light':'dark';}
  catch{return 'dark';}
}

export function saveWorkspaceTheme(mode) {
  try{localStorage.setItem(themeKey,mode);}catch{ /* Keep the choice in the current page. */ }
}
