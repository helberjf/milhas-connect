import { Icon } from "@/components/icon";
import type { WorkspaceView } from "@/lib/navigation";

const content = {
  calculator: { eyebrow: "CADA PONTO CONTA", title: "Suas milhas, bem calculadas.", description: "Descubra o custo da sua emissão e compare as possibilidades da próxima viagem." },
  compare: { eyebrow: "ESCOLHA COM CLAREZA", title: "Encontre a melhor emissão.", description: "Compare custos, taxas e resultados lado a lado. A melhor opção fica em destaque." },
  history: { eyebrow: "SEU PLANEJAMENTO, SALVO", title: "Retome de onde parou.", description: "Consulte suas comparações salvas e recupere os cenários quando precisar." },
  quotes: { eyebrow: "FERRAMENTAS DE VIAGEM", title: "Uma boa viagem começa aqui.", description: "Prepare o orçamento da passagem e gere uma proposta para compartilhar com seu cliente." },
  fuel: { eyebrow: "FERRAMENTAS DE VIAGEM", title: "De olho nos custos da estrada.", description: "Registre seus abastecimentos e acompanhe o consumo e os gastos das suas viagens." },
};
export function PageHeader({ view }: { view: WorkspaceView }) {
  const item = content[view];
  return <div className="page-heading">
    <div>
      <p className="eyebrow"><span className="eyebrow-line" />{item.eyebrow}</p>
      <h1>{item.title}</h1>
      <p className="page-description">{item.description}</p>
    </div>
    <div className="heading-flight" aria-hidden="true">
      <span className="flight-point" /><span className="flight-dash" />
      <span className="flight-plane"><Icon name="plane" size={25} /></span>
      <span className="flight-dash" /><span className="flight-destination" />
    </div>
  </div>;
}
