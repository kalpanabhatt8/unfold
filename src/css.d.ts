/** Allow side-effect imports of global CSS (e.g. `import "./foo.css"`). */
declare module "*.css" {
  const stylesheet: string;
  export default stylesheet;
}
