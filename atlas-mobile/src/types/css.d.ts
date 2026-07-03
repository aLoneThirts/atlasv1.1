// Şablonun CSS import'ları için tip bildirimleri (expo start .expo/types
// üretmeden önce tsc --noEmit'in temiz geçmesi için).
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.css';
