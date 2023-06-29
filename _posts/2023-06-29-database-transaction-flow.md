---
layout: post
title: 스프링 트랜잭션
subtitle: 스프링 트랜잭션 추상화, 흐름
categories: Database, Spring
tags: [Database, Spring]
---

## 스프링 트랜잭션 

### 트랜잭션 추상화

![Service 의존 문제](https://github.com/boseungk/TIL/assets/95980754/2b2665a0-45d3-4f29-978b-387544271a4d)

서비스 계층은 특정 기술에 종속되지 않아야 한다. 

따라서 JDBC 기술을 사용하다가 JPA 기술로 변경하더라도 서비스 계층에서 코드 수정은 없어야 한다. 

하지만 실제로 JDBC 기술에서 JPA 기술로 변경될 때, 많은 코드가 수정된다. (SRP 위배)

이 문제를 해결하기 위해서 스프링에서는 트랜잭션을 추상화해서 제공한다. 

따라서 우리는 스프링이 제공하는 트랜잭션 추상화 기술을 사용하면 된다. 

![스프링 트랜잭션 추상화](https://github.com/boseungk/TIL/assets/95980754/52767a81-80ac-46a6-b392-256ffbc6a1c6)

스프링 트랜잭션 추상화의 핵심은 `PlatformTransactionManager` 인터페이스이다.

```java
package org.springframework.transaction;

public interface PlatformTransactionManager extends TransactionManager {
    TransactionStatus getTransaction(@Nullable TransactionDefinition definition)
            throws TransactionException;

    void commit(TransactionStatus status) throws TransactionException;

    void rollback(TransactionStatus status) throws TransactionException;
}
```

`getTransaction()` 은 트랜잭션을 시작한다는 의미이다. 

기존에 진행 중인 트랜잭션이 있는 경우 해당 트랜잭션에 참여할 수 있다.

`commit()`은 트랜잭션을 커밋한다는 의미이다.

`rollback()`은 트랜잭션을 롤백한다는 의미이다.

### 트랜잭션 매니저의 동작 흐름

![트랜잭션 매니저 동작 흐름 1](https://github.com/boseungk/TIL/assets/95980754/972693fe-1c0f-47ef-bd00-26f5746222eb)

`transactionManager`(트랜잭션 매니저) 는 `dataSource`를 통해 커넥션을 생성하기 때문에 `new DataSourceTransactionManager(dataSource)`에 `dataSource`를 담아준다. 

```java
class MemberServiceV3_1Test {
private MemberRepositoryV3 memberRepository;
    private MemberServiceV3_1 memberService;

    @BeforeEach
    void before(){
        DriverManagerDataSource dataSource = new DriverManagerDataSource(URL, USERNAME, PASSWORD);
        PlatformTransactionManager transactionManager = new DataSourceTransactionManager(dataSource);
        memberRepository = new MemberRepositoryV3(dataSource);
        memberService = new MemberServiceV3_1(transactionManager, memberRepository);
    }
...
}
```

그럼 when 부분에서 `memberService.accountTransfer()` 메서드에서 트랜잭션이 시작된다.

```java
		@Test
    @DisplayName("이체 중 예외 발생")
    void accountTransfer() throws SQLException {
        //given
        Member memberA = new Member(MEMBER_A, 10000);
        Member memberEX = new Member(MEMBER_EX, 10000);
        memberRepository.save(memberA);
        memberRepository.save(memberEX);
        //when 바로 요기
        assertThatThrownBy(() -> memberService.accountTransfer(memberA.getMemberId(), memberEX.getMemberId(), 2000))
                .isInstanceOf(IllegalStateException.class);

        //then
        Member findMemberA = memberRepository.findById(memberA.getMemberId());
        Member findMemberB = memberRepository.findById(memberEX.getMemberId());
        assertThat(findMemberA.getMoney()).isEqualTo(10000);
        assertThat(findMemberB.getMoney()).isEqualTo(10000);
    }
```

`Service`에서  `accountTransfer()`를 자세히 살펴보면 아래와 같다. 

`accountTransfer()`에서는 `transactionManager.getTransaction()`을 통해서 트랜잭션이 시작된다. 

```java
@Slf4j
@RequiredArgsConstructor
public class MemberServiceV3_1 {

    //private final DataSource dataSource;

    private final PlatformTransactionManager transactionManager;
    private final MemberRepositoryV3 memberRepository;

    public void accountTransfer(String fromId, String toId, int money) throws SQLException {

        TransactionStatus status = transactionManager.getTransaction(new DefaultTransactionDefinition());

        try {
            bizLogic(fromId, toId, money);
            transactionManager.commit(status);
        } catch(Exception e){
            transactionManager.rollback(status);
            throw new IllegalStateException(e);
        }
    }
```

트랜잭션을 시작하기 위해서는 데이터베이스 커넥션이 필요하기 때문에 트랜잭션 매니저는 내부에서 데이터 소스를 사용해서 커넥션을 생성한다. 

그리고 커넥션을 수동 커밋 모드로 변경해서 실제 데이터베이스 커넥션을 시작한다.

이후 커넥션을 트랜잭션 동기화 매니저에서 보관된다. 

아래는 JDBC 트랜잭션 매니저가 트랜잭션을 시작하고 트랜잭션 동기화 매니저로부터 리소스를 받는 코드의 일부이다. 

```java
//JDBC 트랜잭션 매니저 내부 코드
public class DataSourceTransactionManager extends AbstractPlatformTransactionManager
		implements ResourceTransactionManager, InitializingBean {
...
@Override
	protected Object doGetTransaction() {
		DataSourceTransactionObject txObject = new DataSourceTransactionObject();
		txObject.setSavepointAllowed(isNestedTransactionAllowed());
		ConnectionHolder conHolder =
				(ConnectionHolder) TransactionSynchronizationManager.getResource(obtainDataSource());
		txObject.setConnectionHolder(conHolder, false);
		return txObject;
	}
...
}
```

이후 `Service`에서 데이터 접근 로직이 실행되면서 `Repository`의 메서드들을 호출한다.

![트랜잭션 매니저 동작 흐름 2](https://github.com/boseungk/TIL/assets/95980754/36e77edc-f637-406b-b177-fdcb349ddacd)

이때 `Repository`의 메서드들은 트랜잭션이 시작된 커넥션이 필요하다. 

이때 `Repository`의 메서드들은 `getConnection`을 통해 커넥션을 얻는다.

```java
@Slf4j
@RequiredArgsConstructor
public class MemberRepositoryV3 {
...
private Connection getConnection() throws SQLException {
        //주의! 트랜잭션 동기화를 사용하려면 DataSourceUtils를 사용해야 한다.
        Connection con = DataSourceUtils.getConnection(dataSource);
        log.info("get connection={}, class={}", con, con.getClass());
        return con;
    }
...
}
```

`getConnection`은 `DataSourceUtils`의 `doGetConnetion`이라는 메서드에서 트랜잭션 동기화 매니저를 호출해서 기존의 커넥션을 획득한다.

아래는 `doGetConnection`코드의 일부이다.

```java
public static Connection doGetConnection(DataSource dataSource) throws SQLException {
		Assert.notNull(dataSource, "No DataSource specified");

		ConnectionHolder conHolder = (ConnectionHolder) TransactionSynchronizationManager.getResource(dataSource);
		if (conHolder != null && (conHolder.hasConnection() || conHolder.isSynchronizedWithTransaction())) {
			conHolder.requested();
			if (!conHolder.hasConnection()) {
				logger.debug("Fetching resumed JDBC Connection from DataSource");
				conHolder.setConnection(fetchConnection(dataSource));
			}
			return conHolder.getConnection();
		}
		// Else we either got no holder or an empty thread-bound holder here.
```

결국 획득한 커넥션을 이용해서 SQL을 데이터베이스에 전달해서 실행한다.

그리고 비즈니스 로직이 끝나면 트랜잭션을 종료한다.

트랜잭션은 커밋하거나 롤백하면 종료된다.

![트랜잭션 매니저 동작 흐름 3](https://github.com/boseungk/TIL/assets/95980754/26f856ba-862b-47dd-a06c-9f23d7ca8b17)

트랜잭션을 종료하려면 동기화된 커넥션이 필요하다. 

위에서 트랜잭션 매니저가 `doGetTransaction()`로 동기화된 커넥션을 가져왔듯이 똑같이 커넥션을 가져와서 데이터베이스에 트랜잭션을 커밋하거나 롤백해서 트랜잭션을 종료한다.

마지막으로 전체 리소스를 정리한다.

이때 `````DataSourceUtils`````의 *`releaseConnection*(con, dataSource)`를 통해 리소스를 정리한다.

정리할 리소스는 

- 트랜잭션 동기화 매니저를 정리한다. 쓰레드 로컬은 사용후 꼭 정리해야 한다.
- con.setAutoCommit(true) 로 되돌린다. 커넥션 풀을 고려해야 한다.
- con.close() 를 호출해서 커넥션을 종료한다. 커넥션 풀을 사용하는 경우 con.close() 를
호출하면 커넥션 풀에 반환된다.

이런 트랜잭션 추상화 덕분에 서비스 코드는 더 이상 JDBC 기술에 의존하지 않게 된다.

이후 JDBC에서 JPA로 변경해도 서비스 코드를 그대로 유지할 수 있다.