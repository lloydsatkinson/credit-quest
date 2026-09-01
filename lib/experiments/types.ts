export type ExperimentSurface =
  | "commercial_route_order"
  | "journey_status_copy"
  | "journey_email_opt_in_copy";

export interface ExperimentVariant {
  key: string;
  presentationKey: string;
}

export interface ActiveExperiment {
  id: string;
  experimentKey: string;
  surface: ExperimentSurface;
  variants: ExperimentVariant[];
}

export const experimentSurfaces: ExperimentSurface[] = [
  "commercial_route_order",
  "journey_status_copy",
  "journey_email_opt_in_copy",
];

export const approvedPresentationKeys: Record<ExperimentSurface, readonly string[]> = {
  commercial_route_order: ["control", "reverse"],
  journey_status_copy: ["control", "concise"],
  journey_email_opt_in_copy: ["control", "benefit_first"],
};
