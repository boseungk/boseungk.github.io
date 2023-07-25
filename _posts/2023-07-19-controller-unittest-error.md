---
layout: post
title: 컨트롤러 단위 테스트 에러 해결하기
subtitle: 삽질 로그
categories: Test
tags: [Spring, Test, 삽질 로그]
---

## 컨트롤러 단위 테스트 에러 해결하기

![단위테스트](https://velog.velcdn.com/images/gda05189/post/f992ff64-0109-4eeb-a9e2-8c6390600a40/image.png)


단위 테스트를 진행할 컨트롤러는 아래와 같다.

```java
@RequiredArgsConstructor
@RestController
public class ProductRestController {

    private final FakeStore fakeStore;

    @GetMapping("/products/{id}")
    public ResponseEntity<?> findById(@PathVariable int id) {

        Product product = fakeStore.getProductList().stream().filter(p -> p.getId() == id).findFirst().orElse(null);

        if(product == null){
            Exception404 ex = new Exception404("해당 상품을 찾을 수 없습니다:"+id);
            return new ResponseEntity<>(
                    ex.body(),
                    ex.status()
            );
        }

        List<Option> optionList = fakeStore.getOptionList().stream().filter(option -> product.getId() == option.getProduct().getId()).collect(Collectors.toList());
        
        ProductResponse.FindByIdDTO responseDTO = new ProductResponse.FindByIdDTO(product, optionList);

        return ResponseEntity.ok(ApiUtils.success(responseDTO));
    }
}
```

먼저 해당 컨트롤러에 대한 리팩토링을 진행했다.

product가 없을 때, 에러를 생성해서 처리를 해주긴 하지만, `globalExceptionHandler`에서 에러를 공통으로 처리할 수 있도록 리팩토링 해주었다. (추후에 `globalExceptionHandler`는 AOP로 분리할 예정)

```java
@RequiredArgsConstructor
@RestController
public class ProductRestController {

		private final GlobalExceptionHandler globalExceptionHandler;

    private final FakeStore fakeStore;

    @GetMapping("/products/{id}")
    public ResponseEntity<?> findById(@PathVariable int id) {

        Product product = fakeStore.getProductList().stream().filter(p -> p.getId() == id).findFirst().orElse(null);

        if(product == null){
            Exception404 ex = new Exception404("해당 상품을 찾을 수 없습니다:"+id);
            return new ResponseEntity<>(
                    ex.body(),
                    ex.status()
            );
        }

        List<Option> optionList = fakeStore.getOptionList().stream().filter(option -> product.getId() == option.getProduct().getId()).collect(Collectors.toList());
        
        ProductResponse.FindByIdDTO responseDTO = new ProductResponse.FindByIdDTO(product, optionList);

        try {
            return ResponseEntity.ok(ApiUtils.success(responseDTO));
        } catch (RuntimeException e) {
            return globalExceptionHandler.handle(e, request);
        }
    }
}
```

이렇게 리팩토링한 후  테스트 코드를 작성해보았다.

```java
@WebMvcTest(controllers = {ProductRestController.class})
@AutoConfigureMockMvc
public class ProductRestControllerTest extends DummyEntity {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper om;

    private final FakeStore fakeStore = new FakeStore();

    private int id;

    @Test
    void findById_product_test() throws Exception{
        id = 1;

        // Json 직렬화로 responseBody를 관찰하기 위한 코드
        Product product = fakeStore.getProductList().stream().filter(p -> p.getId() == id).findFirst().orElse(null);
        List<Option> optionList = fakeStore.getOptionList().stream().filter(option -> product.getId() == option.getProduct().getId()).collect(Collectors.toList());
        ProductResponse.FindByIdDTO responseDTO = new ProductResponse.FindByIdDTO(product, optionList);
        String requestBody = om.writeValueAsString(responseDTO);

        //when
        ResultActions result = mvc.perform(
                MockMvcRequestBuilders
                        .get("/products/" + id)
                        .content(requestBody)
                        .contentType(MediaType.APPLICATION_JSON)

        );
        String responseBody = result.andReturn().getResponse().getContentAsString();
        System.out.println("테스트 : "+responseBody);

        //then
        result.andExpect(MockMvcResultMatchers.jsonPath("$.success").value("true"));
    }
    @Test
    void findById_product_null_test() throws Exception{
        //given
        id = 1000; // product에 없는 id 값
        //when
        ResultActions result = mvc.perform(
                MockMvcRequestBuilders
                        .get("/products/" + id)

        );
        //then
        result.andExpectAll(
                status().is4xxClientError(), // 404 오류 확인
                MockMvcResultMatchers.jsonPath("$.success").value("false")
        );
    }
}
```

그랬더니 아래와 같은 에러가 터졌다..

```java
Caused by: org.springframework.beans.factory.UnsatisfiedDependencyException: 
Error creating bean with name 'productRestController'

Caused by: org.springframework.beans.factory.NoSuchBeanDefinitionException: 
No qualifying bean of type 'com.example.kakao._core.utils.FakeStore' available: 
expected at least 1 bean which qualifies as autowire candidate.
```

에러 메세지를 읽어보면 

FakeStore 클래스에 대해서 

**‘그런 Bean 정의 없어요(NoSuchBeanDefinitionException)’** 

한마디로 FakeStore의 빈 설정 정보가 없다는 뜻이다. 

### NoSuchBeanDefinitionException 예외

그래서 FakeStore 클래스로 가봤다.

근데 아래와 같이 

```java
@Getter
@Component
public class FakeStore {
//...
}
```

@Component로 빈 등록이 되어있었다. 

한참을 구글링 해보면서 이것저것 시도해보다가 

```java
@Import({
        SecurityConfig.class,
        ErrorLogJPARepository.class,
        GlobalExceptionHandler.class,
        FakeStore.class
})
@RequiredArgsConstructor
@RestController
public class ProductRestController {
//...
}
```

이렇게 `@Import`로 빈 설정 정보를 불러오면 된다는 것을 알게 되었다. 

### @Import와 @Configuration

내가 아는 빈 설정 정보는 `@Configuration`이었는데, 궁금해서 `@import`의 [spring docs](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/annotation/Configuration.html)를 참고해보니까 

> `@Configuration` classes may be composed using the `[@Import](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/annotation/Import.html)` annotation, similar to the way that `<import>` works in Spring XML. Because `@Configuration` objects are managed as Spring beans within the container, imported configurations may be injected — for example, via constructor injection
> 

> Spring XML에서 <import>가 작동하는 방식과 유사하게 @Import 어노테이션을 사용하여 @Configuration 클래스를 구성할 수 있습니다. 구성 객체는 컨테이너 내에서 Spring 빈으로 관리되기 때문에 가져온 구성을 생성자 주입을 통해 주입할 수 있습니다(예: 생성자 주입)
> 

`@Import`와 `@Configuration`을 활용하는 [다른 글](http://www.javabyexamples.com/guide-to-import-in-spring)에서는

빈 설정 정보에 다른 빈 설정 정보를 가져와서 사용하는 예제를 확인할 수 있었다.

```java
@Configuration
public class CounterConfiguration {
    @Bean
    public Counter counter() {
        return new Counter();
    }
}

@Configuration
@Import(CounterConfiguration.class)
public class MainConfiguration {
    @Bean
    public ImpressionService impressionService(Counter counter) {
        return new ImpressionService(counter);
    }
}
```

그래서 `@Import`를 이용해서 테스트 코드를 아래와 같이 다시 작성해보았다.

```java
@WebMvcTest(controllers = {ProductRestController.class})
@AutoConfigureMockMvc
public class ProductRestControllerMockTest extends DummyEntity {

    @MockBean
    private ErrorLogJPARepository errorLogJPARepository;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper om;

    private final FakeStore fakeStore = new FakeStore();

    private int id;

    @Test //MockMvc를 이용해서 테스트를 진행한 테스트 코드입니다.
    void findById_product_test() throws Exception{
        id = 1;

        // Json 직렬화로 responseBody를 관찰하기 위한 코드
        Product product = fakeStore.getProductList().stream().filter(p -> p.getId() == id).findFirst().orElse(null);
        List<Option> optionList = fakeStore.getOptionList().stream().filter(option -> product.getId() == option.getProduct().getId()).collect(Collectors.toList());
        ProductResponse.FindByIdDTO responseDTO = new ProductResponse.FindByIdDTO(product, optionList);
        String requestBody = om.writeValueAsString(responseDTO);

        //when
        ResultActions result = mvc.perform(
                MockMvcRequestBuilders
                        .get("/products/" + id)
                        .content(requestBody)
                        .contentType(MediaType.APPLICATION_JSON)

        );
        String responseBody = result.andReturn().getResponse().getContentAsString();
        System.out.println("테스트 : "+responseBody);

        //then
        result.andExpect(MockMvcResultMatchers.jsonPath("$.success").value("true"));
    }
    @Test
    void findById_product_null_test() throws Exception{
        //given
        id = 1000; // product에 없는 id 값
        //when
        ResultActions result = mvc.perform(
                MockMvcRequestBuilders
                        .get("/products/" + id)
        );
        //then
        result.andExpectAll(
                status().is4xxClientError(), // 404 오류 확인
                MockMvcResultMatchers.jsonPath("$.success").value("false")
        );
    }
}
```

그런데 멘토님이 저번 과제에서 

‘id를 직접 하드코딩 하는 것보다 저장된 id를 사용하는 것이 좋다’ 라는 피드백을 주셔서 

그걸 반영해서 테스트 코드를 좀더 발전시켜보았다.

### 테스트 코드 발전시키기

먼저 `@BeforeEach`에서 DummyEntity를 아래와 같이 레포지토리에 전부 저장하려고 했다.

```java
@BeforeEach
    public void setUp(){
        em.createNativeQuery("ALTER TABLE product_tb ALTER COLUMN id RESTART WITH 1").executeUpdate();
        em.createNativeQuery("ALTER TABLE option_tb ALTER COLUMN id RESTART WITH 1").executeUpdate();
        products = productJPARepository.saveAll(productDummyList());
        options = optionJPARepository.saveAll(optionDummyList(products));
    }
```

~~하지만 쉽게 될 리가 없지..!!~~

역시 또 에러가 터졌다.

이번에도 NoSuchBeanDefinitionException 예외가 등장했다.

```java
No qualifying bean of type 'com.example.kakao.product.ProductJPARepository' available:
expected at least 1 bean which qualifies as autowire candidate. Dependency annotations:
```

하지만 재미있는 점은 똑같은 예외지만 그 원인이 달랐다.

발생한 이유는 `@WebMvcTest` 때문이었다. (아까는 설정 정보를 가져오지 않아서)

### @WebMvcTest

`@WebMvcTest`의 목적은 **[SpringMVC 구성요소에만 단위 테스트를 진행하기 위해서](https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/test/autoconfigure/web/servlet/WebMvcTest.html)**이다.

인텔리제이에 나와있는 `@WebMvcTest`에 대한 설명을 요약하면 아래와 같다.

---

@WebMvcTest 어노테이션은 Spring MVC 컴포넌트에만 집중하는 테스트에 사용되며, 전체 자동 구성을 비활성화하고 @Controller, @ControllerAdvice, @JsonComponent, Converter/GenericConverter, Filter, WebMvcConfigurer 및 HandlerMethodArgumentResolver 빈과 함께 적용됩니다. 

**하지만** **@Component, @Service 또는 @Repository 빈은 포함시키지 않습니다.** 

기본적으로 @WebMvcTest로 주석이 달린 테스트는 Spring Security와 MockMvc를 자동 구성하며(HtmlUnit WebClient 및 Selenium WebDriver 지원 포함) MockMvc의 더 세밀한 제어를 위해 @AutoConfigureMockMvc 어노테이션을 사용할 수 있습니다. 

일반적으로 @WebMvcTest는 @Controller 빈이 필요한 경우에 @MockBean 또는 @Import와 함께 사용됩니다.전체 애플리케이션 구성을 로드하고 MockMVC를 사용하려는 경우에는 이 어노테이션 대신 @SpringBootTest를 @AutoConfigureMockMvc와 함께 고려해야 합니다.

---

핵심은 **@Component, @Service 또는 @Repository 빈은 포함시키지 않습니다**는 것!!

다시 말해서 Repository에 데이터를 저장한 후 id를 얻으려면 `@SpringBootTest`와 `@AutoConfigureMockMvc`어노테이션을 활용해야 했다.

그래서 아래와 같이 테스트 코드를 발전시켜 보았다.

```java
//@WebMvcTest(controllers = {ProductRestController.class})
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class ProductRestControllerTest extends DummyEntity {

    @MockBean
    private ErrorLogJPARepository errorLogJPARepository;

    @Autowired
    private ProductJPARepository productJPARepository;

    @Autowired
    private OptionJPARepository optionJPARepository;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper om;

    @Autowired
    private EntityManager em;

    private final FakeStore fakeStore = new FakeStore();

    private List<Product> products;

    private List<Option> options;

    private int id;

    @BeforeEach
    public void setUp(){
        em.createNativeQuery("ALTER TABLE product_tb ALTER COLUMN id RESTART WITH 1").executeUpdate();
        em.createNativeQuery("ALTER TABLE option_tb ALTER COLUMN id RESTART WITH 1").executeUpdate();
        products = productJPARepository.saveAll(productDummyList());
        options = optionJPARepository.saveAll(optionDummyList(products));
    }

    @Test //멘토님의 피드백을 반영해서 JPARepository에 값을 저장한 후 id 값을 불러오게 만들어서 발전시킨 테스트 코드
    void findById_product_test() throws Exception{
        //given
        id = options.get(0).getId(); //Repository에 저장했던 id 값을 불러옴
        
        // Json 직렬화로 responseBody를 관찰하기 위한 코드
        Product product = fakeStore.getProductList().stream().filter(p -> p.getId() == id).findFirst().orElse(null);
        List<Option> optionList = fakeStore.getOptionList().stream().filter(option -> product.getId() == option.getProduct().getId()).collect(Collectors.toList());
        ProductResponse.FindByIdDTO responseDTO = new ProductResponse.FindByIdDTO(product, optionList);
        String requestBody = om.writeValueAsString(responseDTO);

        //when
        ResultActions result = mvc.perform(
                MockMvcRequestBuilders
                        .get("/products/" + id)
                        .content(requestBody)
                        .contentType(MediaType.APPLICATION_JSON)

        );
        String responseBody = result.andReturn().getResponse().getContentAsString();
        System.out.println("테스트 : "+responseBody);

        //then
        result.andExpect(MockMvcResultMatchers.jsonPath("$.success").value("true"));
    }
    @Test
    void findById_product_null_test() throws Exception{
        //given
        id = 1000; // product에 없는 id 값

        //when
        ResultActions result = mvc.perform(
                MockMvcRequestBuilders
                        .get("/products/" + id)
        );

        //then
        result.andExpectAll(
                status().is4xxClientError(), // 404 오류 확인
                MockMvcResultMatchers.jsonPath("$.success").value("false")
                );
    }
}
```

### 느낀점

`@Import`와 `@Configuration`, `@WebMvcTest`, `@SpringBootTest`, `@AutoConfigureMockMvc` 등 다양한 어노테이션들을 좀더 깊게 이해 할 수 있었고, 테스트 코드 설정 및 설계에 대한 공부를 할 수 있었던 시간이었다.