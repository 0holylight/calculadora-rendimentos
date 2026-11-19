// Tipos de erro do app. O tipo diz QUEM causou o problema, e é isso que a tela usa para escolher a mensagem:
// - ErroBancoCentral: a fonte de dados falhou (rede, HTTP, formato). Não é culpa do usuário; vale tentar de novo.
// - ErroPedido: o que o usuário digitou não serve (valor, prazo, percentual). A mensagem já é escrita para ele.
// Qualquer outro Error é um defeito do próprio código.

export class ErroBancoCentral extends Error {
  override name = "ErroBancoCentral";
}

export class ErroPedido extends Error {
  override name = "ErroPedido";
}
