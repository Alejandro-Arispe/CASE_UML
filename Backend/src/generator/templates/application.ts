import { GenerationModel } from '../GenerationModel';
import { generatedFileHeader } from './javaUtil';

export function renderApplicationClass(model: GenerationModel): string {
  return `${generatedFileHeader('Punto de entrada de Spring Boot.')}
package ${model.packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
`;
}
