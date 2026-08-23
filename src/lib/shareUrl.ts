export const SHARE_BASE_URL = "https://spontaway.com";

export const buildShareUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SHARE_BASE_URL}/#${cleanPath}`;
};
