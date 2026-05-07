export function pageArgs(page = 1, pageSize = 20) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
