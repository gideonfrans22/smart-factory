import { DateTime as LuxonDateTime } from "luxon";

export const DateTime = LuxonDateTime.local().setZone("Asia/Seoul").toJSDate();
