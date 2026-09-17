import type { Metadata } from "next";
import { StyleguideDemo } from "./demo";

export const metadata: Metadata = { title: "Design system" };

export default function Styleguide() {
  return <StyleguideDemo />;
}
